const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Monitor = sequelize.define(
  "Monitor",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    method: {
      type: DataTypes.ENUM("GET", "POST", "HEAD", "PUT", "PATCH"),
      defaultValue: "GET",
    },
    headers: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    body: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    intervalSeconds: {
      type: DataTypes.INTEGER,
      defaultValue: 300,
    },
    timeoutMs: {
      type: DataTypes.INTEGER,
      defaultValue: 30000,
    },
    expectedStatus: {
      type: DataTypes.INTEGER,
      defaultValue: 200,
    },
    status: {
      type: DataTypes.ENUM("up", "down", "paused", "pending"),
      defaultValue: "pending",
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
    },
    consecutiveFailures: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    lastCheckedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  { timestamps: true }
);

module.exports = Monitor;
