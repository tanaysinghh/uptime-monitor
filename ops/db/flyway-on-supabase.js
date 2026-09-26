// Flyway rehearsal on a real Supabase database (the staging clone), through the exact
// container and connection settings the Render service uses. Never runs against prod.
//
//   node ops/db/flyway-on-supabase.js clone <image> [hostPort]
//
// Starts the image with the Render environment (TLS verify-full, transaction pooler 6543
// with prepareThreshold=0, Flyway on the session pooler 5432), scheduler off, and checks
// that every existing table is unchanged and flyway_schema_history is baseline V1 + V2.
// Leaves the container "java-on-clone" running for API tests.
const crypto = require("crypto");
const lib = require("./lib");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const [target, image, hostPort = "5040"] = process.argv.slice(2);
  if (target === "prod") throw new Error("this rehearsal never runs against production");
  const conn = lib.supabase(target);

  const fingerprint = async () => {
    const c = lib.pgClient(conn);
    await c.connect();
    const t = await lib.tableFingerprints(c);
    await c.end();
    return t;
  };
  const before = await fingerprint();
  console.log(`before: ${Object.keys(before).length} tables, flyway history present: ${!!before.flyway_schema_history}`);

  const env = {
    NODE_ENV: "production", PORT: "5000", TZ: "UTC",
    DB_HOST: conn.host, DB_PORT: "6543", DB_NAME: conn.database, DB_USER: conn.user, DB_PASSWORD: conn.password,
    DB_SSL: "true", DB_SSL_CA_FILE: "certs/supabase-root-2021.crt", DB_PREPARE_THRESHOLD: "0", FLYWAY_DB_PORT: "5432",
    JWT_SECRET: crypto.randomBytes(32).toString("hex"), JWT_REFRESH_SECRET: crypto.randomBytes(32).toString("hex"),
    JWT_EXPIRES_IN: "15m", JWT_REFRESH_EXPIRES_IN: "7d", MFA_ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex"),
    CLIENT_URL: "http://localhost:5173", ALLOW_PRIVATE_URLS: "false",
    APP_SCHEDULER_ENABLED: process.env.APP_SCHEDULER_ENABLED || "false",
  };
  try { lib.run("docker", ["rm", "-f", "java-on-clone"]); } catch {}
  const args = ["run", "-d", "--name", "java-on-clone", "--memory", "512m", "-p", `${hostPort}:5000`];
  for (const [k, v] of Object.entries(env)) args.push("-e", `${k}=${v}`);
  args.push(image);
  lib.run("docker", args);

  const t0 = Date.now();
  let healthy = false;
  while (Date.now() - t0 < 300000) {
    if (/Exited/.test(lib.run("docker", ["ps", "-a", "--filter", "name=java-on-clone", "--format", "{{.Status}}"]))) break;
    try {
      const r = await fetch(`http://localhost:${hostPort}/api/health`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) { healthy = true; break; }
    } catch {}
    await sleep(1000);
  }
  const logs = lib.run("docker", ["logs", "java-on-clone"]) ;
  const flywayLines = logs.split(/\r?\n/).filter((l) => /Flyway|flyway|Migrat|baseline|Database connection/i.test(l))
    .map((l) => l.replace(/^.*?\]\s+\S+\s+:\s+/, ""));
  console.log(`healthy: ${healthy} after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  flywayLines.forEach((l) => console.log("    " + l));
  if (!healthy) {
    console.error(logs.slice(-4000));
    throw new Error("container did not become healthy");
  }

  const after = await fingerprint();
  const problems = lib.compareFingerprints(before, after, { ignore: ["flyway_schema_history"] });
  const c = lib.pgClient(conn);
  await c.connect();
  const history = (await c.query(`SELECT installed_rank, version, type, description, success FROM flyway_schema_history ORDER BY 1`)).rows;
  await c.end();
  history.forEach((h) => console.log(`    history ${h.installed_rank} v${h.version} ${h.type} ${h.description} success=${h.success}`));
  const ok = problems.length === 0 && history.length === 2 && history[0].type === "BASELINE" && history[1].version === "2"
    && history.every((h) => h.success);
  console.log(`existing tables unchanged: ${problems.length === 0}${problems.length ? "\n    " + problems.join("\n    ") : ""}`);
  if (!ok) throw new Error("rehearsal failed");
  console.log(`FLYWAY ON SUPABASE PASSED (${target}); container java-on-clone left running on :${hostPort}`);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
