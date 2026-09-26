// Consistent backup of a Supabase database's public schema, with a manifest to verify
// any restore against.
//
//   node ops/db/backup.js prod
//
// One REPEATABLE READ transaction exports a snapshot; the per-table row counts and
// checksums are computed inside it and pg_dump dumps that same snapshot, so the manifest
// describes exactly what is in the dump even while the Node server keeps writing checks.
// Writes <BACKUP_DIR>/<target>-<UTC stamp>.dump and .manifest.json.
const fs = require("fs");
const path = require("path");
const lib = require("./lib");

(async () => {
  const target = process.argv[2];
  const conn = lib.supabase(target);
  fs.mkdirSync(lib.BACKUP_DIR, { recursive: true });
  const base = path.join(lib.BACKUP_DIR, `${target}-${lib.stamp()}`);
  const dumpFile = `${base}.dump`;

  const client = lib.pgClient(conn);
  await client.connect();
  const server = (await client.query("SHOW server_version")).rows[0].server_version;
  const ssl = (await client.query("SELECT current_setting('ssl', true) AS on")).rows[0].on;
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY");
  const snapshot = (await client.query("SELECT pg_export_snapshot() AS s")).rows[0].s;
  const fingerprints = await lib.tableFingerprints(client);
  console.log(`${target}: server ${server}, snapshot ${snapshot}, ${Object.keys(fingerprints).length} tables`);

  const started = Date.now();
  lib.run("pg_dump", ["-Fc", "-n", "public", "--no-owner", "--no-privileges", `--snapshot=${snapshot}`, "-f", dumpFile],
    lib.libpqEnv(conn));
  const schema = lib.schemaDump(conn, [`--snapshot=${snapshot}`]);
  await client.query("COMMIT");
  await client.end();

  // The archive must be readable and list every table's data.
  const toc = lib.run("pg_restore", ["--list", dumpFile], process.env);
  const dataEntries = toc.split(/\r?\n/).filter((l) => / TABLE DATA public /.test(l)).length;
  const manifest = {
    target,
    createdAt: new Date().toISOString(),
    serverVersion: server,
    serverSsl: ssl,
    snapshot,
    dumpFile: path.basename(dumpFile),
    sha256: lib.sha256File(dumpFile),
    bytes: fs.statSync(dumpFile).size,
    tocTableDataEntries: dataEntries,
    tables: fingerprints,
    schema,
  };
  fs.writeFileSync(`${base}.manifest.json`, JSON.stringify(manifest, null, 2));
  for (const [name, f] of Object.entries(fingerprints)) console.log(`  ${name.padEnd(16)} ${String(f.rows).padStart(8)} rows  ${f.checksum}`);
  console.log(`dump ${path.basename(dumpFile)}: ${(manifest.bytes / 1e6).toFixed(1)} MB in ${((Date.now() - started) / 1000).toFixed(1)}s, ` +
    `${dataEntries} TABLE DATA entries, sha256 ${manifest.sha256.slice(0, 16)}...`);
  if (dataEntries !== Object.keys(fingerprints).length) throw new Error("TOC does not list data for every table");
  console.log(`manifest ${path.basename(base)}.manifest.json`);
})().catch((e) => {
  console.error("BACKUP FAILED:", e.message);
  process.exit(1);
});
