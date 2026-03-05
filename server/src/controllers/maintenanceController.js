const { Monitor, AuditLog } = require("../models");

const enableMaintenance = async (req, res) => {
  try {
    const { reason, startAt, endAt } = req.body;

    const monitor = await Monitor.findOne({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
      },
    });

    if (!monitor) {
      return res.status(404).json({ error: "Monitor not found" });
    }

    monitor.maintenanceMode = true;
    monitor.maintenanceReason = reason || "Scheduled maintenance";
    monitor.maintenanceStartAt = startAt || new Date();
    monitor.maintenanceEndAt = endAt || null;
    await monitor.save();

    await AuditLog.create({
      organizationId: req.user.organizationId,
      userId: req.user.id,
      action: "enable_maintenance",
      resource: "monitor",
      resourceId: monitor.id,
      details: { reason, startAt, endAt },
      ipAddress: req.ip,
    });

    res.json({ monitor });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const disableMaintenance = async (req, res) => {
  try {
    const monitor = await Monitor.findOne({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
      },
    });

    if (!monitor) {
      return res.status(404).json({ error: "Monitor not found" });
    }

    monitor.maintenanceMode = false;
    monitor.maintenanceReason = null;
    monitor.maintenanceStartAt = null;
    monitor.maintenanceEndAt = null;
    await monitor.save();

    await AuditLog.create({
      organizationId: req.user.organizationId,
      userId: req.user.id,
      action: "disable_maintenance",
      resource: "monitor",
      resourceId: monitor.id,
      details: {},
      ipAddress: req.ip,
    });

    res.json({ monitor });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { enableMaintenance, disableMaintenance };