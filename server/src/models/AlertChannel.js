const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AlertChannel = sequelize.define(
  "AlertChannel",
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
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("email", "webhook", "slack", "discord"),
      allowNull: false,
    },
    config: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    cooldownMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 5,
    },
    lastAlertedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  { timestamps: true }
);

module.exports = AlertChannel;