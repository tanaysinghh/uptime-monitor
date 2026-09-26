// Proves a backup is restorable: restores it into a throwaway local Postgres (Docker, same
// major version as the source) and compares every table's row count and checksum, and the
// schema, with the backup's manifest.
//
//   node ops/db/restore-test.js <path/to/backup.dump> [--keep]
//
// --keep leaves the container (uptime-restore-test, port 55432) running for the Flyway
// rehearsal (flyway-rehearsal.js).
const fs = require("fs");
const lib = require("./lib");

const CONTAINER = "uptime-restore-test";
const PORT = 55432;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const local = (database = "restored") => ({
  label: "local", host: "127.0.0.1", port: PORT, database, user: "postgres", password: "restore-test", tls: false,
});

const startContainer = async (major) => {
  try { lib.run("docker", ["rm", "-f", CONTAINER]); } catch {}
  lib.run("docker", ["run", "-d", "--name", CONTAINER, "-e", "POSTGRES_PASSWORD=restore-test", "-e", "TZ=UTC",
    "-p", `${PORT}:5432`, `postgres:${major}-alpine`]);
  for (let i = 0; i < 60; i++) {
    try {
      const c = lib.pgClient(local("postgres"));
      await c.connect();
      await c.query("SELECT 1");
      await c.end();
      return;
    } catch {
      await sleep(1000);
    }
  }
  throw new Error("local Postgres did not start");
};

(async () => {
  const dumpFile = process.argv[2];
  const keep = process.argv.includes("--keep");
  const manifest = JSON.parse(fs.readFileSync(dumpFile.replace(/\.dump$/, ".manifest.json"), "utf8"));
  if (lib.sha256File(dumpFile) !== manifest.sha256) throw new Error("dump file does not match its manifest (sha256)");
  const major = manifest.serverVersion.split(".")[0];
  console.log(`restoring ${manifest.dumpFile} (${manifest.target}, Postgres ${manifest.serverVersion}) into postgres:${major}`);

  await startContainer(major);
  const admin = lib.pgClient(local("postgres"));
  await admin.connect();
  await admin.query("CREATE DATABASE restored");
  await admin.end();

  lib.run("pg_restore", ["--no-owner", "--no-privileges", "--exit-on-error", "-d", "restored", dumpFile], lib.libpqEnv(local()));

  const c = lib.pgClient(local());
  await c.connect();
  const restored = await lib.tableFingerprints(c);
  await c.end();
  const dataProblems = lib.compareFingerprints(manifest.tables, restored);
  const schemaSame = lib.schemaDump(local()) === manifest.schema;

  for (const [name, f] of Object.entries(restored)) {
    const ok = manifest.tables[name] && manifest.tables[name].checksum === f.checksum && manifest.tables[name].rows === f.rows;
    console.log(`  ${ok ? "OK  " : "DIFF"} ${name.padEnd(16)} ${String(f.rows).padStart(8)} rows`);
  }
  console.log(`schema identical to source: ${schemaSame}`);
  if (!keep) lib.run("docker", ["rm", "-f", CONTAINER]);
  if (dataProblems.length || !schemaSame) {
    console.error("RESTORE TEST FAILED:\n  " + dataProblems.join("\n  "));
    process.exit(1);
  }
  console.log(`RESTORE TEST PASSED: ${Object.keys(restored).length} tables, every row count and checksum matches` +
    (keep ? ` (kept ${CONTAINER} on port ${PORT})` : ""));
})().catch((e) => {
  console.error("RESTORE TEST FAILED:", e.message);
  process.exit(1);
});
