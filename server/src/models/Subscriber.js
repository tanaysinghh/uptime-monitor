const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Subscriber = sequelize.define(
  "Subscriber",
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
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true },
    },
    confirmed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    confirmToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  { timestamps: true }
);

module.exports = Subscriber;