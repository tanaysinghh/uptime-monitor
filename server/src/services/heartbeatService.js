const crypto = require("crypto");
const { Monitor, Check, Incident, Organization } = require("../models");
const { Op } = require("sequelize");
const { emitMonitorUpdate, emitIncidentUpdate } = require("./socketService");

const HEARTBEAT_FAILURE_THRESHOLD = 1;

const createHeartbeatMonitor = async (req, res) => {
  try {
    const { name, heartbeatInterval, tags } = req.body;

    const heartbeatToken = crypto.randomBytes(16).toString("hex");

    const monitor = await Monitor.create({
      name,
      url: "heartbeat://" + heartbeatToken,
      method: "GET",
      monitorType: "heartbeat",
      heartbeatInterval: heartbeatInterval || 300,
      heartbeatToken,
      intervalSeconds: heartbeatInterval || 300,
      tags: tags || [],
      organizationId: req.user.organizationId,
    });

    res.status(201).json({
      monitor,
      pingUrl: "/api/heartbeat/" + heartbeatToken,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const receiveHeartbeat = async (req, res) => {
  try {
    const { token } = req.params;

    const monitor = await Monitor.findOne({
      where: { heartbeatToken: token },
    });

    if (!monitor) {
      return res.status(404).json({ error: "Heartbeat monitor not found" });
    }

    const now = new Date();
    const previousStatus = monitor.status;

    await Check.create({
      monitorId: monitor.id,
      statusCode: 200,
      responseTimeMs: 0,
      isSuccess: true,
      checkedAt: now,
    });

    if (monitor.status === "down") {
      const activeIncident = await Incident.findOne({
        where: {
          monitorId: monitor.id,
          status: { [Op.ne]: "resolved" },
        },
        order: [["startedAt", "DESC"]],
      });

      if (activeIncident) {
        const duration = Math.floor((now - activeIncident.startedAt) / 1000);
        activeIncident.status = "resolved";
        activeIncident.resolvedAt = now;
        activeIncident.durationSeconds = duration;
        await activeIncident.save();

        const org = await Organization.findByPk(monitor.organizationId);
        emitIncidentUpdate(monitor.organizationId, org?.slug, {
          type: "resolved",
          incident: activeIncident,
          monitorName: monitor.name,
        });
      }
    }

    monitor.status = "up";
    monitor.consecutiveFailures = 0;
    monitor.lastHeartbeatAt = now;
    monitor.lastCheckedAt = now;
    await monitor.save();

    if (previousStatus !== "up") {
      emitMonitorUpdate(monitor.organizationId, {
        monitorId: monitor.id,
        name: monitor.name,
        previousStatus,
        currentStatus: "up",
      });
    }

    res.json({ status: "ok", received: now.toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const checkHeartbeatMonitors = async () => {
  const monitors = await Monitor.findAll({
    where: {
      monitorType: "heartbeat",
      status: { [Op.ne]: "paused" },
      maintenanceMode: false,
    },
  });

  const now = Date.now();

  for (const monitor of monitors) {
    const lastBeat = monitor.lastHeartbeatAt
      ? new Date(monitor.lastHeartbeatAt).getTime()
      : 0;
    const elapsed = (now - lastBeat) / 1000;
    const gracePeriod = monitor.heartbeatInterval * 1.5;

    if (elapsed > gracePeriod && monitor.status !== "down") {
      monitor.consecutiveFailures += 1;

      if (monitor.consecutiveFailures >= HEARTBEAT_FAILURE_THRESHOLD) {
        const previousStatus = monitor.status;
        monitor.status = "down";
        monitor.lastCheckedAt = new Date();

        await Check.create({
          monitorId: monitor.id,
          statusCode: null,
          responseTimeMs: null,
          isSuccess: false,
          errorMessage: "No heartbeat received in " + Math.floor(elapsed) + " seconds",
          checkedAt: new Date(),
        });

        const incident = await Incident.create({
          monitorId: monitor.id,
          status: "investigating",
          startedAt: new Date(),
        });

        const org = await Organization.findByPk(monitor.organizationId);
        emitIncidentUpdate(monitor.organizationId, org?.slug, {
          type: "new",
          incident,
          monitorName: monitor.name,
        });

        emitMonitorUpdate(monitor.organizationId, {
          monitorId: monitor.id,
          name: monitor.name,
          previousStatus,
          currentStatus: "down",
        });
      }

      await monitor.save();
    }
  }
};

module.exports = { createHeartbeatMonitor, receiveHeartbeat, checkHeartbeatMonitors };