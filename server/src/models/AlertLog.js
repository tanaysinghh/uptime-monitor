const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AlertLog = sequelize.define(
  "AlertLog",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    monitorId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    incidentId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    channelId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("down", "up", "degraded", "maintenance"),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("sent", "failed"),
      allowNull: false,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sentAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  { timestamps: false }
);

module.exports = AlertLog;