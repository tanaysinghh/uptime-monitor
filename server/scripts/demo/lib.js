// Shared helpers for the demo-data scripts (seed / topup / remove).
//
// Target selection is explicit so a script never falls through to the wrong database:
//   --prod            Supabase production (password from DB_PASSWORD, server/.env.supabase.txt,
//                     or an interactive hidden prompt, in that order)
//   --local=<dbname>  a local Postgres database, using the credentials in server/.env
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const readline = require("readline");
const { Client } = require("pg");

const SERVER_ROOT = path.resolve(__dirname, "..", "..");
const ORG_SLUG = "halden-freight";

const PROD = {
  host: "aws-0-us-west-2.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  user: "postgres.dtkzrgmqgobhddujrvia",
};

const promptHidden = (question) =>
  new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("No DB password: set DB_PASSWORD or create server/.env.supabase.txt"));
      return;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.startsWith(question)) rl.output.write(question);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
  });

const prodPassword = async () => {
  if (process.env.DB_PASSWORD_PROD) return process.env.DB_PASSWORD_PROD;
  const file = path.join(SERVER_ROOT, ".env.supabase.txt");
  if (fs.existsSync(file)) {
    const line = fs.readFileSync(file, "utf8").split(/\r?\n/).find((l) => l.includes("="));
    if (line) return line.slice(line.indexOf("=") + 1).trim();
  }
  return promptHidden("Supabase database password: ");
};

const connect = async (argv = process.argv.slice(2)) => {
  const local = argv.find((a) => a.startsWith("--local="));
  let config;
  let label;
  if (argv.includes("--prod")) {
    config = {
      ...PROD,
      password: await prodPassword(),
      ssl: {
        rejectUnauthorized: true,
        ca: fs.readFileSync(path.join(SERVER_ROOT, "src/config/certs/supabase-root-2021.crt"), "utf8"),
      },
    };
    label = "PRODUCTION (Supabase)";
  } else if (local) {
    require("dotenv").config({ path: path.join(SERVER_ROOT, ".env") });
    config = {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: local.split("=")[1],
    };
    label = `local database "${config.database}"`;
  } else {
    throw new Error("Choose a target: --prod or --local=<dbname>");
  }
  const client = new Client(config);
  await client.connect();
  return { client, label };
};

// Deterministic PRNG so a seed run is reproducible.
const rng = (seed) => {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.normal = () => {
    const u = Math.max(next(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  next.between = (lo, hi) => lo + (hi - lo) * next();
  next.int = (lo, hi) => Math.floor(next.between(lo, hi + 1));
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  return next;
};

const uuid = () => crypto.randomUUID();

// Bulk insert Checks with one array parameter per column.
const insertChecks = async (client, rows, onProgress) => {
  const CHUNK = 5000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const part = rows.slice(i, i + CHUNK);
    await client.query(
      `INSERT INTO "Checks" (id, "monitorId", "statusCode", "responseTimeMs", "isSuccess", "errorMessage", "checkedAt")
       SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::int[], $4::int[], $5::bool[], $6::text[], $7::timestamptz[])`,
      [
        part.map((r) => r.id),
        part.map((r) => r.monitorId),
        part.map((r) => r.statusCode),
        part.map((r) => r.responseTimeMs),
        part.map((r) => r.isSuccess),
        part.map((r) => r.errorMessage),
        part.map((r) => r.checkedAt),
      ]
    );
    if (onProgress) onProgress(Math.min(i + CHUNK, rows.length), rows.length);
  }
};

const counts = async (client) => {
  const tables = ["Organizations", "Users", "Monitors", "Checks", "Incidents", "AlertChannels", "AlertLogs", "AuditLogs"];
  const out = [];
  for (const t of tables) {
    const r = await client.query(`SELECT count(*)::int AS n FROM "${t}"`);
    out.push(`${t}=${r.rows[0].n}`);
  }
  const size = await client.query("SELECT pg_size_pretty(pg_database_size(current_database())) AS s");
  return out.join(" ") + ` | db size ${size.rows[0].s}`;
};

module.exports = { connect, rng, uuid, insertChecks, counts, ORG_SLUG, SERVER_ROOT };
