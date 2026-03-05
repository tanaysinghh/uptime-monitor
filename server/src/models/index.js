const sequelize = require("../config/database");
const User = require("./User");
const Organization = require("./Organization");
const Monitor = require("./Monitor");
const Check = require("./Check");
const Incident = require("./Incident");
const AlertChannel = require("./AlertChannel");
const AlertLog = require("./AlertLog");
const AuditLog = require("./AuditLog");
const Subscriber = require("./Subscriber");
const ApiKey = require("./ApiKey");

Organization.hasMany(User, { foreignKey: "organizationId" });
User.belongsTo(Organization, { foreignKey: "organizationId" });

Organization.hasMany(Monitor, { foreignKey: "organizationId" });
Monitor.belongsTo(Organization, { foreignKey: "organizationId" });

Monitor.hasMany(Check, { foreignKey: "monitorId" });
Check.belongsTo(Monitor, { foreignKey: "monitorId" });

Monitor.hasMany(Incident, { foreignKey: "monitorId" });
Incident.belongsTo(Monitor, { foreignKey: "monitorId" });

Organization.hasMany(AlertChannel, { foreignKey: "organizationId" });
AlertChannel.belongsTo(Organization, { foreignKey: "organizationId" });

Monitor.hasMany(AlertLog, { foreignKey: "monitorId" });
AlertLog.belongsTo(Monitor, { foreignKey: "monitorId" });

AlertChannel.hasMany(AlertLog, { foreignKey: "channelId" });
AlertLog.belongsTo(AlertChannel, { foreignKey: "channelId" });

Incident.hasMany(AlertLog, { foreignKey: "incidentId" });
AlertLog.belongsTo(Incident, { foreignKey: "incidentId" });

Organization.hasMany(AuditLog, { foreignKey: "organizationId" });
AuditLog.belongsTo(Organization, { foreignKey: "organizationId" });

User.hasMany(AuditLog, { foreignKey: "userId" });
AuditLog.belongsTo(User, { foreignKey: "userId" });

Organization.hasMany(Subscriber, { foreignKey: "organizationId" });
Subscriber.belongsTo(Organization, { foreignKey: "organizationId" });

Organization.hasMany(ApiKey, { foreignKey: "organizationId" });
ApiKey.belongsTo(Organization, { foreignKey: "organizationId" });

User.hasMany(ApiKey, { foreignKey: "userId" });
ApiKey.belongsTo(User, { foreignKey: "userId" });

module.exports = {
  sequelize,
  User,
  Organization,
  Monitor,
  Check,
  Incident,
  AlertChannel,
  AlertLog,
  AuditLog,
  Subscriber,
  ApiKey,
};