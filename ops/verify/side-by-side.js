// Side-by-side comparison of the two backends checking the same monitors: Node against
// production, Java against the staging clone (a restored copy, so monitor ids match).
//
//   DEMO_PW=... node ops/verify/side-by-side.js [--since <ISO time>] [--email <admin email>]
//
// Uses each backend's own API (no database access). For every monitor, over the window:
//   - check counts and cadence (median gap between checks),
//   - success/failure agreement, pairing each Java check with the nearest Node check,
//   - current status, and latency medians / p95 (different hosts, so only broadly comparable),
//   - incidents opened in the window.
const NODE = "https://uptime-monitor-server.onrender.com/api";
const JAVA = "https://uptime-monitor-server-java.onrender.com/api";
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const since = new Date(arg("--since", new Date(Date.now() - 2 * 3600e3).toISOString()));
const email = arg("--email", "tanay@haldenfreight.io");

const call = async (base, path, token, init = {}) => {
  const r = await fetch(base + path, {
    ...init,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    signal: AbortSignal.timeout(120000),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(`${base}${path}: ${r.status} ${JSON.stringify(body)}`);
  return body;
};
const login = async (base) =>
  (await call(base, "/auth/login", null, { method: "POST", body: JSON.stringify({ email, password: process.env.DEMO_PW }) })).accessToken;

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};
const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : null;
};

(async () => {
  const [nodeToken, javaToken] = await Promise.all([login(NODE), login(JAVA)]);
  const [nodeMonitors, javaMonitors] = await Promise.all([call(NODE, "/monitors", nodeToken), call(JAVA, "/monitors", javaToken)]);
  const javaById = new Map(javaMonitors.monitors.map((m) => [m.id, m]));
  console.log(`window: since ${since.toISOString()} (${((Date.now() - since) / 3600e3).toFixed(1)} h)`);
  let disagreements = 0;
  let compared = 0;
  const rows = [];
  for (const nm of nodeMonitors.monitors.sort((a, b) => a.name.localeCompare(b.name))) {
    const jm = javaById.get(nm.id);
    if (!jm) { rows.push(`${nm.name}: missing on Java`); continue; }
    const [nc, jc] = await Promise.all([
      call(NODE, `/monitors/${nm.id}/checks?period=24h`, nodeToken),
      call(JAVA, `/monitors/${nm.id}/checks?period=24h`, javaToken),
    ]);
    const inWindow = (list) => list.checks.filter((c) => new Date(c.checkedAt) >= since)
      .map((c) => ({ ...c, t: new Date(c.checkedAt).getTime() })).sort((a, b) => a.t - b.t);
    const n = inWindow(nc);
    const j = inWindow(jc);
    const gaps = (xs) => xs.slice(1).map((c, i) => (c.t - xs[i].t) / 1000);
    // Pair each Java check with the nearest Node check within half an interval.
    let agree = 0, differ = 0;
    const half = (nm.intervalSeconds * 1000) / 2;
    const diffs = [];
    for (const c of j) {
      let best = null;
      for (const d of n) if (!best || Math.abs(d.t - c.t) < Math.abs(best.t - c.t)) best = d;
      if (!best || Math.abs(best.t - c.t) > half) continue;
      if (best.isSuccess === c.isSuccess) agree++;
      else { differ++; diffs.push(`${new Date(c.t).toISOString().slice(11, 19)} java=${c.isSuccess ? "ok" : c.errorMessage} node=${best.isSuccess ? "ok" : best.errorMessage}`); }
    }
    compared += agree + differ;
    disagreements += differ;
    const lat = (xs) => xs.filter((c) => c.isSuccess && c.responseTimeMs != null).map((c) => c.responseTimeMs);
    rows.push(`${nm.name.padEnd(24)} status node=${nm.status} java=${jm.status}${nm.status === jm.status ? "" : "  <-- DIFFERENT"}\n` +
      `    checks node=${n.length} java=${j.length}  cadence(median gap s) node=${median(gaps(n))} java=${median(gaps(j))}\n` +
      `    success agreement ${agree}/${agree + differ}` +
      `  failures node=${n.filter((c) => !c.isSuccess).length} java=${j.filter((c) => !c.isSuccess).length}\n` +
      `    latency ms median/p95 node=${median(lat(n))}/${pct(lat(n), 0.95)} java=${median(lat(j))}/${pct(lat(j), 0.95)}` +
      (diffs.length ? "\n    disagreements: " + diffs.slice(0, 5).join("; ") : ""));
  }
  const [ni, ji] = await Promise.all([call(NODE, "/stats/dashboard", nodeToken), call(JAVA, "/stats/dashboard", javaToken)]);
  console.log(rows.join("\n"));
  console.log(`active incidents node=${ni.activeIncidents.length} java=${ji.activeIncidents.length}`);
  console.log(`overall: ${compared - disagreements}/${compared} paired checks agree (${disagreements} disagreements)`);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
