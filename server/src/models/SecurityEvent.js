const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const SecurityEvent = sequelize.define(
  "SecurityEvent",
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
    organizationId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    eventType: {
      type: DataTypes.ENUM(
        "login_success",
        "login_failure",
        "account_locked",
        "mfa_enabled",
        "mfa_disabled",
        "mfa_challenge_success",
        "mfa_challenge_failure",
        "backup_code_used",
        "backup_codes_regenerated",
        "password_changed",
        "session_revoked",
        "sessions_revoked_all"
      ),
      allowNull: false,
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
  },
  {
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ["userId", "createdAt"] }],
  }
);

module.exports = SecurityEvent;
