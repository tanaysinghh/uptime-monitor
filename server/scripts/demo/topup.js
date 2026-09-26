// Fill the gaps in Halden Freight's check history left while the Render free instance
// was asleep (it stops the scheduler after 15 idle minutes), then wake the server.
//
//   cd server && node scripts/demo/topup.js --prod
//
// Every gap longer than two check intervals, up to now, is filled at the monitor's
// interval. Values are resampled from the same monitor's checks at a similar time of day
// over the previous week, so latency and failure rates match what that monitor has been
// doing. Maintenance windows from the audit log are left empty, as the scheduler would.
// Safe to run repeatedly: a second run finds no gaps.
const { connect, rng, uuid, insertChecks, counts, ORG_SLUG } = require("./lib");

const SERVER_HEALTH = "https://uptime-monitor-server-java.onrender.com/api/health";
const HOUR = 3600000;
const DAY = 24 * HOUR;

const wakeServer = async () => {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch(SERVER_HEALTH, { signal: AbortSignal.timeout(60000) });
      if (res.ok) return `awake (${(await res.text()).slice(0, 60)})`;
    } catch {
      // cold start in progress
    }
  }
  return "did not answer; open the app in a browser to wake it";
};

(async () => {
  const { client, label } = await connect();
  console.log(`target: ${label}`);
  const rand = rng(Date.now() & 0xffffffff);
  try {
    const org = await client.query(`SELECT id FROM "Organizations" WHERE slug = $1`, [ORG_SLUG]);
    if (!org.rowCount) throw new Error(`No "${ORG_SLUG}" organization; run seed.js first`);
    const orgId = org.rows[0].id;
    const monitors = (await client.query(
      `SELECT * FROM "Monitors" WHERE "organizationId" = $1 AND "monitorType" = 'http' AND status <> 'paused' AND NOT "maintenanceMode"`,
      [orgId]
    )).rows;
    const maint = (await client.query(
      `SELECT "resourceId", action, "createdAt" FROM "AuditLogs"
       WHERE "organizationId" = $1 AND action IN ('enable_maintenance','disable_maintenance') ORDER BY "createdAt"`,
      [orgId]
    )).rows;

    const now = Date.now();
    const rows = [];
    const report = [];
    for (const m of monitors) {
      const step = m.intervalSeconds * 1000;
      const windows = [];
      let openAt = null;
      for (const a of maint.filter((x) => x.resourceId === m.id)) {
        if (a.action === "enable_maintenance") openAt = a.createdAt.getTime();
        else if (openAt != null) {
          windows.push([openAt, a.createdAt.getTime()]);
          openAt = null;
        }
      }
      const inMaint = (t) => windows.some(([a, b]) => t >= a && t <= b);

      const recent = (await client.query(
        `SELECT "statusCode", "responseTimeMs", "isSuccess", "errorMessage", "checkedAt" FROM "Checks"
         WHERE "monitorId" = $1 AND "checkedAt" >= $2 ORDER BY "checkedAt"`,
        [m.id, new Date(now - 90 * DAY)]
      )).rows;
      if (!recent.length) continue;

      const gaps = [];
      for (let i = 1; i <= recent.length; i++) {
        const a = recent[i - 1].checkedAt.getTime();
        const b = i < recent.length ? recent[i].checkedAt.getTime() : now;
        if (b - a > 2 * step) gaps.push([a, b]);
      }

      let added = 0;
      let failures = 0;
      let run = 0;
      let lastTick = null;
      for (const [a, b] of gaps) {
        // Sample from the week before the gap, same time of day (+/- 1h).
        // A monitor that is down stays down, so it only draws from its failures.
        const pool = recent.filter((c) => c.checkedAt.getTime() < a && c.checkedAt.getTime() >= a - 7 * DAY &&
          (m.status !== "down" || !c.isSuccess));
        if (!pool.length) continue;
        for (let t = a + step; t < b - step / 2; t += step) {
          if (inMaint(t)) continue;
          const hour = new Date(t).getUTCHours();
          const near = pool.filter((c) => {
            const d = Math.abs(c.checkedAt.getUTCHours() - hour);
            return Math.min(d, 24 - d) <= 1;
          });
          const src = (near.length ? near : pool)[Math.floor(rand() * (near.length || pool.length))];
          let pick = { ...src };
          // Keep healthy monitors from growing an unrecorded outage: a third failure in a
          // row would have opened an incident, so it becomes a success instead.
          if (!pick.isSuccess && m.status !== "down" && run >= 2) {
            const ok = pool.find((c) => c.isSuccess) || pick;
            pick = { ...ok };
          }
          run = pick.isSuccess ? 0 : run + 1;
          if (!pick.isSuccess) failures++;
          const rt = Math.max(1, Math.round(pick.responseTimeMs * Math.exp(0.08 * rand.normal())));
          rows.push({
            id: uuid(),
            monitorId: m.id,
            statusCode: pick.statusCode,
            responseTimeMs: rt,
            isSuccess: pick.isSuccess,
            errorMessage: pick.isSuccess ? null : pick.errorMessage,
            checkedAt: new Date(t + rt + rand.int(3, 25)),
          });
          added++;
          lastTick = t;
        }
      }
      if (added) {
        report.push({ m, added, failures, lastTick });
      }
      console.log(`${m.name}: ${gaps.length} gap(s), ${added} checks to add`);
    }

    if (rows.length) {
      await client.query("BEGIN");
      await insertChecks(client, rows);
      for (const { m, failures, lastTick } of report) {
        const newer = !m.lastCheckedAt || lastTick > m.lastCheckedAt.getTime();
        if (m.status === "down") {
          await client.query(`UPDATE "Monitors" SET "consecutiveFailures" = "consecutiveFailures" + $2 WHERE id = $1`, [m.id, failures]);
        }
        if (newer) await client.query(`UPDATE "Monitors" SET "lastCheckedAt" = $2 WHERE id = $1`, [m.id, new Date(lastTick)]);
      }
      await client.query("COMMIT");
    }
    console.log(`added ${rows.length} checks`);
    console.log("now:", await counts(client));
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
  if (process.argv.includes("--prod")) console.log("server:", await wakeServer());
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
