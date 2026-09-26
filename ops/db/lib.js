// Shared helpers for the database migration tooling (backup, restore, verification).
//
// Targets are explicit; nothing ever falls back to a default database:
//   prod   Supabase "uptime-monitor-prod"          (ref dtkzrgmqgobhddujrvia)
//   clone  Supabase "uptime-monitor-java-staging"  (ref aiopnkhxtvrqgfvfordi)
// Both are reached through the session pooler (5432) with TLS verify-full against the
// bundled Supabase root CA. The password is read from server/.env.supabase.txt
// (DB_PASSWORD=...), or the PROD / CLONE file named by DB_PASSWORD_FILE_<TARGET>.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const REPO = path.resolve(__dirname, "..", "..");
const SERVER = path.join(REPO, "server");
const { Client } = require(path.join(SERVER, "node_modules", "pg"));

const CA_FILE = path.join(SERVER, "src", "config", "certs", "supabase-root-2021.crt");
const BACKUP_DIR = path.resolve(REPO, "..", "db-backups");
const POOLER = "aws-0-us-west-2.pooler.supabase.com";

const TARGETS = {
  prod: { ref: "dtkzrgmqgobhddujrvia", passwordFile: ".env.supabase.txt" },
  clone: { ref: "aiopnkhxtvrqgfvfordi", passwordFile: ".env.supabase.txt" },
};

const readPassword = (target) => {
  const override = process.env[`DB_PASSWORD_FILE_${target.toUpperCase()}`];
  const file = override || path.join(SERVER, TARGETS[target].passwordFile);
  if (!fs.existsSync(file)) throw new Error(`Password file not found: ${file}`);
  const line = fs.readFileSync(file, "utf8").split(/\r?\n/).find((l) => l.includes("="));
  if (!line) throw new Error(`No KEY=value line in ${file}`);
  return line.slice(line.indexOf("=") + 1).trim();
};

/** Connection parameters for a Supabase target, or a local {host,port,database,user,password}. */
const supabase = (target, { port = 5432 } = {}) => {
  if (!TARGETS[target]) throw new Error(`Unknown target "${target}" (prod | clone)`);
  return {
    label: target,
    host: POOLER,
    port,
    database: "postgres",
    user: `postgres.${TARGETS[target].ref}`,
    password: readPassword(target),
    tls: true,
  };
};

const pgClient = (conn) =>
  new Client({
    host: conn.host,
    port: conn.port,
    database: conn.database,
    user: conn.user,
    password: conn.password,
    ssl: conn.tls ? { rejectUnauthorized: true, ca: fs.readFileSync(CA_FILE, "utf8") } : false,
  });

/** Environment for libpq tools (pg_dump, pg_restore, psql): password and TLS never on argv. */
const libpqEnv = (conn) => ({
  ...process.env,
  PGHOST: conn.host,
  PGPORT: String(conn.port),
  PGDATABASE: conn.database,
  PGUSER: conn.user,
  PGPASSWORD: conn.password,
  PGSSLMODE: conn.tls ? "verify-full" : "disable",
  ...(conn.tls ? { PGSSLROOTCERT: CA_FILE } : {}),
  PGTZ: "UTC",
});

const run = (cmd, args, env) =>
  execFileSync(cmd, args, { env, encoding: "utf8", maxBuffer: 1024 * 1024 * 512, stdio: ["ignore", "pipe", "pipe"] });

/**
 * Per-table row count and content checksum for every table in public, computed in the
 * client's current transaction (so inside an exported snapshot when there is one).
 * Rows are hashed as text in UTC, ordered by primary key; identical data gives
 * identical checksums on any server of the same major version.
 */
const tableFingerprints = async (client) => {
  await client.query("SET TIME ZONE 'UTC'; SET datestyle = 'ISO, YMD'; SET extra_float_digits = 3");
  const tables = (
    await client.query(`
      SELECT c.relname AS name,
             string_agg(quote_ident(a.attname), ', ' ORDER BY array_position(i.indkey, a.attnum)) AS pk
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      LEFT JOIN pg_index i ON i.indrelid = c.oid AND i.indisprimary
      LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY (i.indkey)
      WHERE c.relkind = 'r'
      GROUP BY c.relname ORDER BY c.relname`)
  ).rows;
  const out = {};
  for (const t of tables) {
    const order = t.pk || "t::text";
    const r = await client.query(
      `SELECT count(*)::bigint AS rows, md5(coalesce(string_agg(md5(t::text), '' ORDER BY ${order}), '')) AS checksum
       FROM public.${JSON.stringify(t.name)} t`
    );
    out[t.name] = { rows: Number(r.rows[0].rows), checksum: r.rows[0].checksum };
  }
  return out;
};

/** Schema-only dump, normalized so two dumps of the same schema compare equal. */
const schemaDump = (conn, extraArgs = []) => {
  const sql = run("pg_dump", ["--schema-only", "--no-owner", "--no-privileges", "-n", "public", ...extraArgs], libpqEnv(conn));
  return sql
    .split(/\r?\n/)
    .filter((l) => !l.startsWith("--") && !/^SET |^SELECT pg_catalog\.set_config|^\\(un)?restrict /.test(l) && l.trim() !== "")
    .join("\n");
};

const compareFingerprints = (expected, actual, { ignore = [] } = {}) => {
  const problems = [];
  const names = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const name of [...names].sort()) {
    if (ignore.includes(name)) continue;
    const e = expected[name];
    const a = actual[name];
    if (!e) problems.push(`${name}: present only after (${a.rows} rows)`);
    else if (!a) problems.push(`${name}: missing (had ${e.rows} rows)`);
    else if (e.rows !== a.rows || e.checksum !== a.checksum)
      problems.push(`${name}: rows ${e.rows} -> ${a.rows}, checksum ${e.checksum === a.checksum ? "same" : "DIFFERENT"}`);
  }
  return problems;
};

const sha256File = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

module.exports = {
  REPO, SERVER, CA_FILE, BACKUP_DIR, supabase, pgClient, libpqEnv, run,
  tableFingerprints, schemaDump, compareFingerprints, sha256File, stamp,
};
