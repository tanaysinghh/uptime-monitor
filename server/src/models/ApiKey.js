const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const crypto = require("crypto");

const ApiKey = sequelize.define(
  "ApiKey",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    keyHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    keyPrefix: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    permissions: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: ["read"],
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  { timestamps: true }
);

ApiKey.generateKey = () => {
  const key = "um_" + crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const prefix = key.substring(0, 10);
  return { key, hash, prefix };
};

ApiKey.hashKey = (key) => {
  return crypto.createHash("sha256").update(key).digest("hex");
};

module.exports = ApiKey;