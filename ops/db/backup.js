// Consistent backup of a Supabase database's public schema, with a manifest to verify
// any restore against.
//
//   node ops/db/backup.js prod
//
// One REPEATABLE READ transaction exports a snapshot. Everything below reads that same
// snapshot, so the backup is one point in time even while the Node server writes checks:
//   - per-table row counts and checksums (the manifest),
//   - pg_dump of the schema and every table's data except "Checks",
//   - "Checks" as ~5-day slices, several in parallel.
// Supabase's pooler streams COPY at roughly 20 KB/s per connection from here and cuts
// long single streams, so the large table goes in short parallel pieces, each retried.
//
// Output: <BACKUP_DIR>/<target>-<UTC stamp>/ with base.dump, checks-NNN.copy files and
// manifest.json (sha256 of every file).
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const lib = require("./lib");

const BIG_TABLE = "Checks";
const SLICE_DAYS = 5;
const PARALLEL = 6;
const ATTEMPTS = 4;

const psqlCopy = (env, snapshot, where, outFile) =>
  new Promise((resolve, reject) => {
    const script = [
      "BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY;",
      `SET TRANSACTION SNAPSHOT '${snapshot}';`,
      `\\copy (SELECT * FROM public."${BIG_TABLE}" WHERE ${where} ORDER BY id) TO '${outFile.replace(/\\/g, "/")}'`,
      "COMMIT;",
    ].join("\n");
    const p = spawn("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", "-"], { env });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    const timer = setTimeout(() => { p.kill(); reject(new Error("slice timed out after 10 min")); }, 600000);
    p.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(err.trim() || `psql exited ${code}`));
    });
    p.stdin.end(script);
  });

(async () => {
  const target = process.argv[2];
  const conn = lib.supabase(target);
  const dir = path.join(lib.BACKUP_DIR, `${target}-${lib.stamp()}`);
  fs.mkdirSync(dir, { recursive: true });

  const client = lib.pgClient(conn);
  await client.connect();
  const server = (await client.query("SHOW server_version")).rows[0].server_version;
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY");
  const snapshot = (await client.query("SELECT pg_export_snapshot() AS s")).rows[0].s;
  const fingerprints = await lib.tableFingerprints(client);
  const range = (await client.query(
    `SELECT min("checkedAt") AS lo, max("checkedAt") AS hi, count(*) FILTER (WHERE "checkedAt" IS NULL)::int AS nulls FROM public."${BIG_TABLE}"`
  )).rows[0];
  console.log(`${target}: Postgres ${server}, snapshot ${snapshot}, ${Object.keys(fingerprints).length} tables, ` +
    `${BIG_TABLE} ${fingerprints[BIG_TABLE].rows} rows`);

  const t0 = Date.now();
  const env = lib.libpqEnv(conn);
  lib.run("pg_dump", ["-Fc", "-n", "public", "--no-owner", "--no-privileges", `--snapshot=${snapshot}`,
    `--exclude-table-data=public."${BIG_TABLE}"`, "-f", path.join(dir, "base.dump")], env);
  const schema = lib.schemaDump(conn, [`--snapshot=${snapshot}`]);
  console.log(`base.dump written in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

  // Slice boundaries on whole UTC days; open-ended first and last slices, and NULLs.
  const slices = [];
  if (range.lo) {
    const day = 86400000;
    let from = Math.floor(new Date(range.lo).getTime() / day) * day;
    const hi = new Date(range.hi).getTime();
    slices.push({ where: `"checkedAt" < '${new Date(from).toISOString()}'` });
    while (from <= hi) {
      const to = from + SLICE_DAYS * day;
      slices.push({ where: `"checkedAt" >= '${new Date(from).toISOString()}' AND "checkedAt" < '${new Date(to).toISOString()}'` });
      from = to;
    }
    slices.push({ where: `"checkedAt" >= '${new Date(from).toISOString()}'` });
  }
  slices.push({ where: `"checkedAt" IS NULL` });
  slices.forEach((s, i) => (s.file = `checks-${String(i).padStart(3, "0")}.copy`));

  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < slices.length) {
      const s = slices[next++];
      for (let attempt = 1; ; attempt++) {
        try {
          await psqlCopy(env, snapshot, s.where, path.join(dir, s.file));
          break;
        } catch (e) {
          if (attempt >= ATTEMPTS) throw new Error(`${s.file}: ${e.message}`);
          console.log(`  ${s.file} attempt ${attempt} failed (${e.message.split("\n")[0]}), retrying`);
        }
      }
      done++;
      process.stdout.write(`\r  ${BIG_TABLE} slices ${done}/${slices.length}`);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  process.stdout.write("\n");
  await client.query("COMMIT");
  await client.end();

  // Every row exactly once: slice line counts must add up to the snapshot's row count.
  let sliceRows = 0;
  for (const s of slices) {
    const text = fs.readFileSync(path.join(dir, s.file), "utf8");
    s.rows = text === "" ? 0 : text.split("\n").length - 1;
    sliceRows += s.rows;
  }
  if (sliceRows !== fingerprints[BIG_TABLE].rows) {
    throw new Error(`${BIG_TABLE}: slices hold ${sliceRows} rows, snapshot has ${fingerprints[BIG_TABLE].rows}`);
  }
  const toc = lib.run("pg_restore", ["--list", path.join(dir, "base.dump")], process.env);
  const files = ["base.dump", ...slices.map((s) => s.file)].map((f) => ({
    file: f, bytes: fs.statSync(path.join(dir, f)).size, sha256: lib.sha256File(path.join(dir, f)),
  }));
  const manifest = {
    target, createdAt: new Date().toISOString(), serverVersion: server, snapshot,
    bigTable: BIG_TABLE, slices: slices.map(({ file, where, rows }) => ({ file, where, rows })),
    tocTableDataEntries: toc.split(/\r?\n/).filter((l) => / TABLE DATA public /.test(l)).length,
    files, tables: fingerprints, schema,
  };
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  for (const [name, f] of Object.entries(fingerprints)) console.log(`  ${name.padEnd(16)} ${String(f.rows).padStart(8)} rows  ${f.checksum}`);
  const mb = files.reduce((a, f) => a + f.bytes, 0) / 1e6;
  console.log(`backup ${path.basename(dir)}: ${files.length} files, ${mb.toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(0)}s; ` +
    `${BIG_TABLE} ${sliceRows} rows in ${slices.length} slices`);
})().catch((e) => {
  console.error("\nBACKUP FAILED:", e.message);
  process.exit(1);
});
