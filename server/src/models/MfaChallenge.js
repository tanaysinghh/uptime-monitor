const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const MfaChallenge = sequelize.define(
  "MfaChallenge",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    usedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
  },
  {
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ["userId"] }],
  }
);

module.exports = MfaChallenge;
