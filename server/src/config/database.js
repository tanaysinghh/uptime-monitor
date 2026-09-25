const { Sequelize } = require("sequelize");
require("dotenv").config();

// Managed Postgres providers such as Neon only accept TLS connections. DB_SSL=true turns
// it on with full certificate verification (Neon's certificates chain to public CAs);
// local Postgres keeps working without it.
const dialectOptions =
  process.env.DB_SSL === "true" ? { ssl: { require: true, rejectUnauthorized: true } } : {};

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    dialectOptions,
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
