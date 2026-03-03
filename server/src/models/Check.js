const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Check = sequelize.define(
  "Check",
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
    statusCode: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    responseTimeMs: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    isSuccess: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    checkedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  { timestamps: false }
);

module.exports = Check;
