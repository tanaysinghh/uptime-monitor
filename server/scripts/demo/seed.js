// Demo data for the Halden Freight organization.
//
//   DEMO_ADMIN_PASSWORD=... node scripts/demo/seed.js --prod setup
//                                              org, admin user, alert channels (inactive),
//                                              monitors. The live scheduler starts checking.
//   node scripts/demo/seed.js --prod history   90 days of check history ending at the first
//                                              live check, calibrated to the live response
//                                              times; past incidents, alert and audit logs;
//                                              channels activated.
//
// Running `setup` first and waiting ~20 minutes lets the real checks establish each
// monitor's actual latency from the server, so the seeded history joins the live data
// without a visible step. `history` works without live checks too (local testing).
const bcrypt = require("bcryptjs");
const { evaluatePassword } = require("../../src/utils/passwordPolicy");
const { connect, rng, uuid, insertChecks, counts, ORG_SLUG } = require("./lib");

const ORG_NAME = "Halden Freight";
// The admin password comes from DEMO_ADMIN_PASSWORD so it never lives in the repository.
const ADMIN = { email: "tanay@haldenfreight.io", name: "Tanay Singh", password: process.env.DEMO_ADMIN_PASSWORD };
const DAY = 86400000;
const MIN = 60000;
const INTERVAL_S = 300;
const HISTORY_DAYS = 90;

// base: typical response time (ms) before calibration; sigma: log-normal spread;
// diurnal: daily swing; spikeP: chance of a slow outlier per check.
const MONITORS = [
  { key: "github", name: "GitHub API", url: "https://api.github.com/rate_limit", expectedStatus: 200,
    tags: ["vendor", "ci"], base: 95, sigma: 0.18, diurnal: 0.12, spikeP: 0.006 },
  { key: "npm", name: "npm Registry", url: "https://registry.npmjs.org/-/ping", expectedStatus: 200,
    tags: ["ci", "build"], base: 60, sigma: 0.24, diurnal: 0.15, spikeP: 0.01 },
  { key: "dns", name: "Cloudflare DNS (DoH)", url: "https://cloudflare-dns.com/dns-query?name=example.com&type=A",
    headers: { accept: "application/dns-json" }, expectedStatus: 200,
    tags: ["network"], base: 30, sigma: 0.2, diurnal: 0.08, spikeP: 0.004 },
  { key: "docker", name: "Docker Hub Registry", url: "https://registry-1.docker.io/v2/", expectedStatus: 401,
    tags: ["ci", "containers"], base: 140, sigma: 0.2, diurnal: 0.1, spikeP: 0.008 },
  // Wikimedia answers 403 to generic HTTP client user agents.
  { key: "wiki", name: "Wikipedia", url: "https://www.wikipedia.org", expectedStatus: 200,
    headers: { "User-Agent": "HaldenFreightUptime/1.0 (https://haldenfreight.io; ops@haldenfreight.io)" },
    tags: ["public-web"], base: 75, sigma: 0.22, diurnal: 0.14, spikeP: 0.006 },
  { key: "ghstatus", name: "GitHub Status", url: "https://www.githubstatus.com/api/v2/status.json", expectedStatus: 200,
    tags: ["vendor", "status"], base: 48, sigma: 0.2, diurnal: 0.08, spikeP: 0.005 },
  { key: "hn", name: "Hacker News API", url: "https://hacker-news.firebaseio.com/v0/topstories.json", expectedStatus: 200,
    tags: ["partner-api"], base: 130, sigma: 0.3, diurnal: 0.2, spikeP: 0.012, degraded: true },
  { key: "legacy", name: "npm Hooks (legacy v1)", url: "https://registry.npmjs.org/-/npm/v1/hooks", expectedStatus: 200,
    tags: ["legacy", "webhooks"], base: 85, sigma: 0.2, diurnal: 0.1, spikeP: 0.006, down: true },
];

const CHANNELS = [
  { name: "#ops-alerts", type: "slack", config: { webhookUrl: "https://hooks.slack.com/services/T04HFRT0000/B06OPSALERT/placeholder0000000000000000" } },
  { name: "PagerDuty bridge", type: "webhook", config: { url: "https://events.pd-bridge.haldenfreight.io/v1/uptime" } },
  { name: "#eng-oncall", type: "discord", config: { webhookUrl: "https://discord.com/api/webhooks/1200000000000000000/placeholder-eng-oncall" } },
];

// Past failures. dayAgo/hourUtc place the first failing check; each entry is one check.
// Runs of 3+ consecutive failures open an incident, exactly as the scheduler does.
const TIMEOUT = { statusCode: null, errorMessage: "Timeout after 30000ms", timeout: true };
const RESET = { statusCode: null, errorMessage: "socket hang up" };
const code = (expected, got) => ({ statusCode: got, errorMessage: `Expected status ${expected}, got ${got}` });
const OUTAGES = {
  github: [
    { dayAgo: 71, hourUtc: 9.4, checks: [code(200, 502)] },
    { dayAgo: 42, hourUtc: 17.2, checks: [code(200, 503), TIMEOUT, code(200, 503)] },
  ],
  npm: [
    { dayAgo: 55, hourUtc: 4.6, checks: [RESET] },
    { dayAgo: 3, hourUtc: 14.3, checks: [code(200, 503), code(200, 503), TIMEOUT, code(200, 503), code(200, 502), code(200, 503)] },
  ],
  dns: [{ dayAgo: 23, hourUtc: 21.8, checks: [RESET, RESET] }],
  docker: [
    { dayAgo: 64, hourUtc: 12.1, checks: [TIMEOUT] },
    { dayAgo: 16, hourUtc: 15.7, checks: [code(401, 503), code(401, 503), code(401, 503), code(401, 500)] },
  ],
  wiki: [{ dayAgo: 67, hourUtc: 6.2, checks: [TIMEOUT] }],
};
const DOCKER_MAINTENANCE = { dayAgo: 30, hourUtc: 2, hours: 1, reason: "Registry mirror cutover" };
const DEGRADED_DAYS = 12; // recent days where the Hacker News API misses its latency SLO
const LEGACY_DOWN_HOURS = 30; // the legacy hooks endpoint has been failing this long

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};

const setup = async (client) => {
  const existing = await client.query(`SELECT id FROM "Organizations" WHERE slug = $1`, [ORG_SLUG]);
  if (existing.rowCount) throw new Error(`Organization "${ORG_SLUG}" already exists; run remove.js first`);
  if (!ADMIN.password) throw new Error("Set DEMO_ADMIN_PASSWORD to the admin account's password");
  const pw = evaluatePassword(ADMIN.password, [ADMIN.email, ADMIN.name, ORG_NAME]);
  if (!pw.ok) throw new Error("Admin password fails the password policy: " + pw.reason);

  const now = Date.now();
  const orgCreated = new Date(now - (HISTORY_DAYS + 4) * DAY);
  const orgId = uuid();
  const userId = uuid();
  await client.query("BEGIN");
  await client.query(
    `INSERT INTO "Organizations" (id, name, slug, "brandColor", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$5)`,
    [orgId, ORG_NAME, ORG_SLUG, "#22c55e", orgCreated]
  );
  await client.query(
    `INSERT INTO "Users" (id, email, password, name, role, "isVerified", "organizationId", "failedLoginAttempts",
       "mfaEnabled", "mfaBackupCodes", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,'admin',true,$5,0,false,'{}',$6,$6)`,
    [userId, ADMIN.email, await bcrypt.hash(ADMIN.password, 12), ADMIN.name, orgId, orgCreated]
  );
  for (const [i, ch] of CHANNELS.entries()) {
    const created = new Date(orgCreated.getTime() + (i + 1) * 3 * 3600000);
    await client.query(
      `INSERT INTO "AlertChannels" (id, "organizationId", name, type, config, "isActive", "cooldownMinutes", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,false,5,$6,$6)`,
      [uuid(), orgId, ch.name, ch.type, JSON.stringify(ch.config), created]
    );
  }
  for (const [i, m] of MONITORS.entries()) {
    const created = new Date(now - (HISTORY_DAYS + 1) * DAY + i * 7 * MIN);
    await client.query(
      `INSERT INTO "Monitors" (id, name, url, method, headers, "intervalSeconds", "timeoutMs", "expectedStatus", status,
         tags, "consecutiveFailures", "organizationId", assertions, "monitorType", "maintenanceMode", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,'GET',$4,$5,30000,$6,'pending',$7,0,$8,'[]','http',false,$9,$9)`,
      [uuid(), m.name, m.url, JSON.stringify(m.headers || {}), INTERVAL_S, m.expectedStatus, m.tags, orgId, created]
    );
  }
  await client.query("COMMIT");
  console.log(`created ${ORG_NAME} (${ORG_SLUG}), admin ${ADMIN.email}, ${CHANNELS.length} channels (inactive), ${MONITORS.length} monitors`);
};

// One monitor's generated history between `start` and `end`.
const generate = (m, calib, start, end, rand, extra) => {
  const rows = [];
  const incidents = [];
  const base = m.base * calib;
  const drift = [];
  let walk = 0;
  for (let d = 0; d <= HISTORY_DAYS + 2; d++) {
    walk = walk * 0.85 + rand.normal() * 0.03;
    drift.push(1 + walk);
  }
  const outages = (OUTAGES[m.key] || []).map((o) => ({
    at: end - o.dayAgo * DAY - ((end % DAY) - o.hourUtc * 3600000),
    checks: o.checks,
  }));
  const maint = m.key === "docker" ? DOCKER_MAINTENANCE : null;
  const maintStart = maint ? end - maint.dayAgo * DAY - ((end % DAY) - maint.hourUtc * 3600000) : null;
  const maintEnd = maint ? maintStart + maint.hours * 3600000 : null;
  const downFrom = m.down ? end - LEGACY_DOWN_HOURS * 3600000 : null;
  const degradedFrom = m.degraded ? end - DEGRADED_DAYS * DAY : null;

  // Scheduler cadence: every interval, with a small extra gap on "deploy" restarts.
  const ticks = [];
  let t = start;
  let nextDeploy = start + rand.between(4, 10) * DAY;
  while (t < end) {
    if (!(maint && t >= maintStart && t < maintEnd)) ticks.push(t);
    t += INTERVAL_S * 1000;
    if (t > nextDeploy) {
      t += rand.int(30, 270) * 1000;
      nextDeploy = t + rand.between(4, 12) * DAY;
    }
  }

  // Which ticks fail, and with what.
  const failAt = new Map();
  for (const o of outages) {
    const first = ticks.findIndex((x) => x >= o.at);
    if (first < 0) continue;
    o.checks.forEach((c, i) => failAt.set(first + i, c));
  }
  if (m.degraded) {
    // 5-11 SLO misses a day, never three in a row, so the monitor stays "up".
    for (let day = 0; day < DEGRADED_DAYS; day++) {
      const lo = ticks.findIndex((x) => x >= degradedFrom + day * DAY);
      if (lo < 0) break;
      let hi = ticks.findIndex((x) => x >= degradedFrom + (day + 1) * DAY);
      if (hi < 0) hi = ticks.length;
      const want = rand.int(5, 11);
      let placed = 0;
      for (let guard = 0; placed < want && guard < 500; guard++) {
        const idx = rand.int(lo, hi - 1);
        if (failAt.has(idx) || (failAt.has(idx - 1) && failAt.has(idx - 2)) || (failAt.has(idx + 1) && failAt.has(idx + 2)) ||
            (failAt.has(idx - 1) && failAt.has(idx + 1))) continue;
        failAt.set(idx, { slo: true });
        placed++;
      }
    }
  }

  const latency = (tick) => {
    const date = new Date(tick);
    const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
    const weekend = [0, 6].includes(date.getUTCDay()) ? 0.94 : 1;
    const dayIdx = Math.floor((tick - start) / DAY);
    let v = base * (1 + m.diurnal * Math.sin((2 * Math.PI * (hour - 10)) / 24)) * weekend * drift[dayIdx] *
      Math.exp(m.sigma * rand.normal());
    if (degradedFrom && tick >= degradedFrom) v *= 1.25;
    if (rand() < m.spikeP) v *= rand.between(2, 4.5);
    return Math.max(Math.round(v), Math.round(base * 0.45));
  };

  let run = 0;
  let open = null;
  ticks.forEach((tick, i) => {
    let rt = latency(tick);
    let row;
    const fail = failAt.get(i) || (downFrom && tick >= downFrom ? extra.legacyFailure : null);
    if (!fail && m.sloMs && rt > m.sloMs && (run >= 2 || (degradedFrom && tick >= degradedFrom) || rand() < 0.75)) {
      // The planned misses drive the degraded days, a third miss in a row would open an
      // incident, and before the regression only the occasional spike breaches; keep the
      // rest just under the SLO.
      rt = Math.round(m.sloMs * rand.between(0.82, 0.97));
    }
    if (!fail && m.sloMs && rt > m.sloMs) {
      row = { statusCode: m.expectedStatus, isSuccess: false, errorMessage: `Response time ${rt}ms exceeds ${m.sloMs}ms` };
    } else if (!fail) {
      row = { statusCode: m.expectedStatus, isSuccess: true, errorMessage: null };
    } else if (fail.slo) {
      rt = Math.round(m.sloMs * rand.between(1.08, 2.2));
      row = { statusCode: m.expectedStatus, isSuccess: false, errorMessage: `Response time ${rt}ms exceeds ${m.sloMs}ms` };
    } else {
      if (fail.timeout) rt = 30000 + rand.int(20, 400);
      else if (fail.statusCode == null) rt = rand.int(80, 2500);
      row = { statusCode: fail.statusCode, isSuccess: false, errorMessage: fail.errorMessage };
    }
    rows.push({ id: uuid(), monitorId: m.id, responseTimeMs: rt, checkedAt: new Date(tick + rt + rand.int(3, 25)), ...row });

    // Mirror healthCheckService.handleStatusChange.
    if (row.isSuccess) {
      if (open) {
        open.resolvedAt = new Date(tick + rt);
        open.status = "resolved";
        incidents.push(open);
        open = null;
      }
      run = 0;
    } else {
      run++;
      if (run === 3 && !open) open = { id: uuid(), monitorId: m.id, startedAt: new Date(tick + rt), status: "investigating" };
    }
  });
  if (open) {
    open.status = "identified";
    incidents.push(open);
  }
  const last = ticks[ticks.length - 1];
  return { rows, incidents, run, lastTick: last, maint: maint ? { ...maint, start: maintStart, end: maintEnd } : null };
};

const history = async (client) => {
  const org = await client.query(`SELECT id FROM "Organizations" WHERE slug = $1`, [ORG_SLUG]);
  if (!org.rowCount) throw new Error("Run `setup` first");
  const orgId = org.rows[0].id;
  const user = await client.query(`SELECT id FROM "Users" WHERE "organizationId" = $1 LIMIT 1`, [orgId]);
  const userId = user.rows[0].id;
  const monitors = (await client.query(`SELECT * FROM "Monitors" WHERE "organizationId" = $1`, [orgId])).rows;
  const channels = (await client.query(`SELECT * FROM "AlertChannels" WHERE "organizationId" = $1 ORDER BY "createdAt"`, [orgId])).rows;
  const byName = new Map(monitors.map((r) => [r.name, r]));

  const live = (await client.query(
    `SELECT c.* FROM "Checks" c JOIN "Monitors" m ON m.id = c."monitorId" WHERE m."organizationId" = $1 ORDER BY c."checkedAt"`,
    [orgId]
  )).rows;
  const firstLive = live.length ? live[0].checkedAt.getTime() : Date.now();
  const oldest = await client.query(
    `SELECT count(*)::int AS n FROM "Checks" c JOIN "Monitors" m ON m.id = c."monitorId"
     WHERE m."organizationId" = $1 AND c."checkedAt" < m."createdAt" + interval '30 days'`,
    [orgId]
  );
  if (oldest.rows[0].n > 0) throw new Error("History already seeded");

  const rand = rng(20260926);
  const allRows = [];
  const allIncidents = [];
  const summary = [];
  let dockerMaint = null;
  let legacyRun = 0;

  for (const m of MONITORS) {
    const row = byName.get(m.name);
    if (!row) throw new Error("Missing monitor " + m.name);
    m.id = row.id;
    const mine = live.filter((c) => c.monitorId === m.id);
    // Each monitor's history ends a minute before its own first real check.
    const end = (mine.length ? mine[0].checkedAt.getTime() : firstLive) - 60000;
    const start = end - HISTORY_DAYS * DAY;
    const ok = mine.filter((c) => c.isSuccess).map((c) => c.responseTimeMs);
    let calib = ok.length >= 2 ? median(ok) / m.base : 1;
    if (m.degraded) {
      // Live checks already see the regression (x1.25), so the normal-period base is lower,
      // and the SLO sits at 2.2x the live median.
      m.sloMs = Math.max(100, Math.round((m.base * calib * 2.2) / 50) * 50);
      calib /= 1.25;
    }
    const liveFail = mine.find((c) => !c.isSuccess);
    const extra = {
      legacyFailure: liveFail
        ? { statusCode: liveFail.statusCode, errorMessage: liveFail.errorMessage }
        : code(200, 404),
    };
    const g = generate(m, calib, start, end, rand, extra);
    allRows.push(...g.rows);
    allIncidents.push(...g.incidents);
    if (g.maint) dockerMaint = { ...g.maint, monitorId: m.id };
    if (m.down) legacyRun = g.run;
    const up = g.rows.filter((r) => r.isSuccess).length;
    summary.push(`${m.name}: ${g.rows.length} checks, ${((up / g.rows.length) * 100).toFixed(2)}% up, ` +
      `live ${mine.length} (median ${ok.length ? median(ok) : "-"}ms), calib x${calib.toFixed(2)}` +
      (m.sloMs ? `, SLO ${m.sloMs}ms` : ""));
  }

  await client.query("BEGIN");
  await insertChecks(client, allRows, (n, total) => process.stdout.write(`\rchecks ${n}/${total}`));
  process.stdout.write("\n");

  const alerts = [];
  for (const inc of allIncidents) {
    const mon = MONITORS.find((x) => x.id === inc.monitorId);
    if (inc.status === "resolved") {
      const duration = Math.floor((inc.resolvedAt - inc.startedAt) / 1000);
      await client.query(
        `INSERT INTO "Incidents" (id, "monitorId", status, "startedAt", "resolvedAt", "durationSeconds", "createdAt", "updatedAt")
         VALUES ($1,$2,'resolved',$3,$4,$5,$3,$4)`,
        [inc.id, inc.monitorId, inc.startedAt, inc.resolvedAt, duration]
      );
    } else {
      // The live scheduler may already have opened this incident; backdate it instead of duplicating.
      const liveOpen = await client.query(
        `SELECT id FROM "Incidents" WHERE "monitorId" = $1 AND status <> 'resolved' ORDER BY "startedAt" LIMIT 1`,
        [inc.monitorId]
      );
      if (liveOpen.rowCount) {
        inc.id = liveOpen.rows[0].id;
        await client.query(
          `UPDATE "Incidents" SET status = 'identified', "startedAt" = $2, "createdAt" = $2, "updatedAt" = $3 WHERE id = $1`,
          [inc.id, inc.startedAt, new Date(inc.startedAt.getTime() + 47 * MIN)]
        );
        await client.query(`DELETE FROM "AlertLogs" WHERE "incidentId" = $1`, [inc.id]);
      } else {
        await client.query(
          `INSERT INTO "Incidents" (id, "monitorId", status, "startedAt", "createdAt", "updatedAt") VALUES ($1,$2,'identified',$3,$3,$4)`,
          [inc.id, inc.monitorId, inc.startedAt, new Date(inc.startedAt.getTime() + 47 * MIN)]
        );
      }
    }
    for (const ch of channels) {
      alerts.push({ monitorId: inc.monitorId, incidentId: inc.id, channelId: ch.id, type: "down", sentAt: new Date(inc.startedAt.getTime() + 400 + rand.int(0, 900)) });
      if (inc.resolvedAt) {
        alerts.push({ monitorId: inc.monitorId, incidentId: inc.id, channelId: ch.id, type: "up", sentAt: new Date(inc.resolvedAt.getTime() + 400 + rand.int(0, 900)) });
      }
    }
    summary.push(`incident ${mon.name}: ${inc.status} ${inc.startedAt.toISOString()}` +
      (inc.resolvedAt ? ` -> ${inc.resolvedAt.toISOString()}` : ""));
  }
  // Live checks may have logged failed alert attempts before the channels were active.
  await client.query(`DELETE FROM "AlertLogs" WHERE "channelId" = ANY($1::uuid[])`, [channels.map((c) => c.id)]);
  for (const a of alerts) {
    await client.query(
      `INSERT INTO "AlertLogs" (id, "monitorId", "incidentId", "channelId", type, status, "sentAt") VALUES ($1,$2,$3,$4,$5,'sent',$6)`,
      [uuid(), a.monitorId, a.incidentId, a.channelId, a.type, a.sentAt]
    );
  }
  for (const ch of channels) {
    const last = alerts.filter((a) => a.channelId === ch.id).map((a) => a.sentAt).sort((a, b) => b - a)[0] || null;
    await client.query(`UPDATE "AlertChannels" SET "isActive" = true, "lastAlertedAt" = $2 WHERE id = $1`, [ch.id, last]);
  }

  // Audit trail: the maintenance window and a few configuration changes.
  const audit = [];
  if (dockerMaint) {
    audit.push({ action: "enable_maintenance", resource: "monitor", resourceId: dockerMaint.monitorId, at: dockerMaint.start - 90000,
      details: { reason: dockerMaint.reason, startAt: new Date(dockerMaint.start).toISOString(), endAt: new Date(dockerMaint.end).toISOString() } });
    audit.push({ action: "disable_maintenance", resource: "monitor", resourceId: dockerMaint.monitorId, at: dockerMaint.end + 120000, details: {} });
  }
  for (const a of audit) {
    await client.query(
      `INSERT INTO "AuditLogs" (id, "organizationId", "userId", action, resource, "resourceId", details, "ipAddress", "createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [uuid(), orgId, userId, a.action, a.resource, a.resourceId, JSON.stringify(a.details), "203.0.113.24", new Date(a.at)]
    );
  }

  // Monitor state after history + live checks.
  for (const m of MONITORS) {
    const mine = live.filter((c) => c.monitorId === m.id);
    let liveRun = 0;
    for (const c of mine) liveRun = c.isSuccess ? 0 : liveRun + 1;
    const assertions = m.sloMs ? [{ type: "response_time", value: String(m.sloMs) }] : [];
    if (m.down) {
      const failures = mine.every((c) => !c.isSuccess) ? legacyRun + mine.length : liveRun;
      await client.query(
        `UPDATE "Monitors" SET status = 'down', "consecutiveFailures" = $2, assertions = $3 WHERE id = $1`,
        [m.id, failures, JSON.stringify(assertions)]
      );
    } else {
      await client.query(`UPDATE "Monitors" SET assertions = $2 WHERE id = $1`, [m.id, JSON.stringify(assertions)]);
    }
    if (!mine.length) {
      const lastRow = allRows.filter((r) => r.monitorId === m.id).pop();
      await client.query(
        `UPDATE "Monitors" SET "lastCheckedAt" = $2, status = CASE WHEN status = 'pending' THEN 'up'::"enum_Monitors_status" ELSE status END WHERE id = $1`,
        [m.id, lastRow.checkedAt]
      );
    }
  }
  await client.query("COMMIT");
  console.log(summary.join("\n"));
};

(async () => {
  const phase = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!["setup", "history"].includes(phase)) throw new Error("Usage: seed.js --prod|--local=<db> setup|history");
  const { client, label } = await connect();
  console.log(`target: ${label}`);
  try {
    if (phase === "setup") await setup(client);
    else await history(client);
    console.log("now:", await counts(client));
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
