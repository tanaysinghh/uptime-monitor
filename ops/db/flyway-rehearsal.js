// Flyway rehearsal on a restored copy of production (restore-test.js --keep first).
//
//   node ops/db/flyway-rehearsal.js <path/to/server-java.jar>
//
// Boots the real Spring Boot app (scheduler off, so nothing but Flyway writes) against
// the copy, twice, and checks that:
//   - every existing table keeps exactly the same rows (count + checksum),
//   - the only schema change is the new flyway_schema_history table,
//   - history = baseline at V1 + V2, and the second boot migrates nothing.
const { spawn } = require("child_process");
const path = require("path");
const lib = require("./lib");

const local = { label: "local", host: "127.0.0.1", port: 55432, database: "restored", user: "postgres", password: "restore-test", tls: false };

const snapshot = async () => {
  const c = lib.pgClient(local);
  await c.connect();
  const tables = await lib.tableFingerprints(c);
  await c.end();
  return { tables, schema: lib.schemaDump(local) };
};

const bootApp = (jar, label) =>
  new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      DB_HOST: local.host, DB_PORT: String(local.port), DB_NAME: local.database, DB_USER: local.user, DB_PASSWORD: local.password,
      PORT: "5020", NODE_ENV: "development",
      APP_SCHEDULER_ENABLED: "false",
    };
    const java = spawn("java", ["-Dapp.scheduler.enabled=false", "-jar", jar], {
      cwd: path.join(lib.REPO, "server-java"), env,
    });
    let log = "";
    const timer = setTimeout(() => { java.kill(); reject(new Error(`${label}: no startup within 180s\n${log.slice(-3000)}`)); }, 180000);
    const onData = (d) => {
      log += d;
      if (/Started UptimeMonitorApplication/.test(log)) {
        clearTimeout(timer);
        java.kill();
        const flyway = log.split(/\r?\n/).filter((l) => /flyway|Flyway|Migrat|baseline|callback/i.test(l))
          .map((l) => l.replace(/^.*?\]\s+\S+\s+:\s+/, "")).join("\n    ");
        resolve(flyway);
      }
      if (/APPLICATION FAILED TO START|Application run failed/.test(log)) {
        clearTimeout(timer);
        java.kill();
        reject(new Error(`${label}: app failed to start\n${log.slice(-4000)}`));
      }
    };
    java.stdout.on("data", onData);
    java.stderr.on("data", onData);
  });

const schemaDiff = (before, after) => {
  const a = new Set(before.split("\n"));
  const b = new Set(after.split("\n"));
  return {
    added: [...b].filter((l) => !a.has(l)),
    removed: [...a].filter((l) => !b.has(l)),
  };
};

(async () => {
  const jar = path.resolve(process.argv[2]);
  const before = await snapshot();
  console.log(`before: ${Object.keys(before.tables).length} tables`);

  console.log("boot 1:\n    " + await bootApp(jar, "boot 1"));
  const after1 = await snapshot();
  console.log("boot 2:\n    " + await bootApp(jar, "boot 2"));
  const after2 = await snapshot();

  const c = lib.pgClient(local);
  await c.connect();
  const history = (await c.query(
    `SELECT installed_rank, version, description, type, success FROM flyway_schema_history ORDER BY installed_rank`)).rows;
  await c.end();

  const dataProblems = lib.compareFingerprints(before.tables, after1.tables, { ignore: ["flyway_schema_history"] });
  const diff = schemaDiff(before.schema, after1.schema);
  const unexpectedAdded = diff.added.filter((l) => !/flyway_schema_history/.test(l) && !/^\s|^\)|^CREATE TABLE|^ALTER TABLE ONLY|^    ADD CONSTRAINT/.test(l));
  const secondBootChanged = lib.compareFingerprints(after1.tables, after2.tables).length > 0 || after1.schema !== after2.schema;

  console.log("flyway_schema_history:");
  for (const h of history) console.log(`    ${h.installed_rank}  v${h.version}  ${h.type.padEnd(12)} ${h.description}  success=${h.success}`);
  console.log(`schema lines removed: ${diff.removed.length}`);
  diff.removed.forEach((l) => console.log(`    - ${l}`));
  console.log(`schema lines added (all should belong to flyway_schema_history): ${diff.added.length}`);
  diff.added.forEach((l) => console.log(`    + ${l}`));
  console.log(`data problems in existing tables: ${dataProblems.length ? "\n    " + dataProblems.join("\n    ") : "none"}`);
  console.log(`second boot changed anything: ${secondBootChanged}`);

  const expectedHistory = history.length === 2 && history[0].type === "BASELINE" && history[0].version === "1"
    && history[1].version === "2" && history.every((h) => h.success);
  const onlyFlywayTableAdded = Object.keys(after1.tables).filter((t) => !before.tables[t]).join(",") === "flyway_schema_history";
  if (dataProblems.length || diff.removed.length || unexpectedAdded.length || secondBootChanged || !expectedHistory || !onlyFlywayTableAdded) {
    console.error("FLYWAY REHEARSAL FAILED");
    process.exit(1);
  }
  console.log("FLYWAY REHEARSAL PASSED: baseline V1 + V2 only, no existing row or schema object changed, second boot a no-op");
})().catch((e) => {
  console.error("FLYWAY REHEARSAL FAILED:", e.message);
  process.exit(1);
});
