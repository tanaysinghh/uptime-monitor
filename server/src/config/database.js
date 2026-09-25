const fs = require("fs");
const path = require("path");
const { Sequelize } = require("sequelize");
require("dotenv").config();

// Managed Postgres providers only accept TLS connections. DB_SSL=true turns TLS on with
// full certificate verification; it is never disabled. Providers that sign with their
// own root CA (Supabase: "Supabase Root 2021 CA") need that CA supplied either as
//   DB_SSL_CA_FILE - a PEM file path, relative to the server root (e.g. the bundled
//                    src/config/certs/supabase-root-2021.crt), or
//   DB_SSL_CA      - the PEM text itself (literal "\n" sequences are accepted).
// Local Postgres keeps working with DB_SSL unset.
const SERVER_ROOT = path.resolve(__dirname, "..", "..");

const buildDialectOptions = (env = process.env) => {
  if (env.DB_SSL !== "true") return {};
  const ssl = { require: true, rejectUnauthorized: true };
  if (env.DB_SSL_CA_FILE) {
    ssl.ca = fs.readFileSync(path.resolve(SERVER_ROOT, env.DB_SSL_CA_FILE), "utf8");
  } else if (env.DB_SSL_CA) {
    ssl.ca = env.DB_SSL_CA.replace(/\\n/g, "\n");
  }
  return { ssl };
};

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    dialectOptions: buildDialectOptions(),
    logging: false,
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000,
    },
  }
);

module.exports = sequelize;
module.exports.buildDialectOptions = buildDialectOptions;
