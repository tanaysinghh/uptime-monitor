const { Sequelize } = require("sequelize");
require("dotenv").config();

// Managed Postgres providers only accept TLS connections. DB_SSL=true turns TLS on with
// full certificate verification. Providers that sign with their own root CA (Supabase:
// "Supabase Root 2021 CA") need that CA passed in DB_SSL_CA as PEM text; literal "\n"
// sequences are accepted so the PEM can live in a single-line env var. Verification is
// never disabled. Local Postgres keeps working with DB_SSL unset.
const buildDialectOptions = (env = process.env) => {
  if (env.DB_SSL !== "true") return {};
  const ssl = { require: true, rejectUnauthorized: true };
  if (env.DB_SSL_CA) ssl.ca = env.DB_SSL_CA.replace(/\\n/g, "\n");
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
