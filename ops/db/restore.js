// Restores a backup made by backup.js into a database and verifies it against the
// manifest: every table's row count and checksum, and the schema.
//
// Used by restore-test.js (throwaway local Postgres) and to seed the staging clone:
//   node ops/db/restore.js <backup dir> clone
// Refuses to restore into a database whose public schema already has tables, and
// refuses the prod target outright.
const fs = require("fs");
const os = require("os");
const path = require("path");
const lib = require("./lib");

const restoreInto = async (dir, conn) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  for (const f of manifest.files) {
    if (lib.sha256File(path.join(dir, f.file)) !== f.sha256) throw new Error(`${f.file}: sha256 does not match the manifest`);
  }

  const c = lib.pgClient(conn);
  await c.connect();
  const existing = (await c.query(
    `SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'`)).rows[0].n;
  await c.end();
  if (existing > 0) throw new Error(`target ${conn.label} already has ${existing} tables in public; refusing to restore over it`);

  const env = lib.libpqEnv(conn);
  // "-n public" dumps include CREATE SCHEMA public, which every fresh database (and
  // Supabase) already has; restore from the archive's TOC without that one entry.
  const dump = path.join(dir, "base.dump");
  const toc = lib.run("pg_restore", ["--list", dump], process.env).split(/\r?\n/);
  const listFile = path.join(os.tmpdir(), `restore-${process.pid}.list`);
  fs.writeFileSync(listFile, toc.filter((l) => !/ SCHEMA - public /.test(l)).join("\n"));
  try {
    lib.run("pg_restore", ["--no-owner", "--no-privileges", "--exit-on-error", "-L", listFile, "-d", conn.database, dump], env);
  } finally {
    fs.rmSync(listFile, { force: true });
  }

  // Load the big table's slices (its FK targets are already in place).
  for (const s of manifest.slices) {
    const file = path.join(dir, s.file).replace(/\\/g, "/");
    lib.run("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-c",
      `\\copy public."${manifest.bigTable}" FROM '${file}'`], env);
  }

  const v = lib.pgClient(conn);
  await v.connect();
  const restored = await lib.tableFingerprints(v);
  await v.end();
  const problems = lib.compareFingerprints(manifest.tables, restored);
  const schemaSame = lib.schemaDump(conn) === manifest.schema;
  return { manifest, restored, problems, schemaSame };
};

module.exports = { restoreInto };

if (require.main === module) {
  (async () => {
    const [dir, target] = process.argv.slice(2);
    if (target === "prod") throw new Error("restore.js never writes to production");
    const { restored, problems, schemaSame } = await restoreInto(path.resolve(dir), lib.supabase(target));
    for (const [name, f] of Object.entries(restored)) console.log(`  ${name.padEnd(16)} ${String(f.rows).padStart(8)} rows`);
    console.log(`schema identical to source: ${schemaSame}`);
    if (problems.length || !schemaSame) {
      console.error("RESTORE FAILED VERIFICATION:\n  " + problems.join("\n  "));
      process.exit(1);
    }
    console.log(`RESTORE VERIFIED on ${target}: every row count and checksum matches the backup`);
  })().catch((e) => {
    console.error("RESTORE FAILED:", e.message);
    process.exit(1);
  });
}
