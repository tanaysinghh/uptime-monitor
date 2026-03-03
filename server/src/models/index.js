const sequelize = require("../config/database");
const User = require("./User");
const Organization = require("./Organization");
const Monitor = require("./Monitor");
const Check = require("./Check");
const Incident = require("./Incident");

Organization.hasMany(User, { foreignKey: "organizationId" });
User.belongsTo(Organization, { foreignKey: "organizationId" });

Organization.hasMany(Monitor, { foreignKey: "organizationId" });
Monitor.belongsTo(Organization, { foreignKey: "organizationId" });

Monitor.hasMany(Check, { foreignKey: "monitorId" });
Check.belongsTo(Monitor, { foreignKey: "monitorId" });

Monitor.hasMany(Incident, { foreignKey: "monitorId" });
Incident.belongsTo(Monitor, { foreignKey: "monitorId" });

module.exports = {
  sequelize,
  User,
  Organization,
  Monitor,
  Check,
  Incident,
};
