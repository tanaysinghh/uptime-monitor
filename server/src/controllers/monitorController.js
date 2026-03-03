const { Monitor, Check, Incident } = require("../models");
const { Op } = require("sequelize");

const createMonitor = async (req, res) => {
  try {
    const { name, url, method, headers, body, intervalSeconds, timeoutMs, expectedStatus, tags } = req.body;

    const monitor = await Monitor.create({
      name,
      url,
      method: method || "GET",
      headers: headers || {},
      body: body || null,
      intervalSeconds: intervalSeconds || 300,
      timeoutMs: timeoutMs || 30000,
      expectedStatus: expectedStatus || 200,
      tags: tags || [],
      organizationId: req.user.organizationId,
    });

    res.status(201).json({ monitor });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMonitors = async (req, res) => {
  try {
    const monitors = await Monitor.findAll({
      where: { organizationId: req.user.organizationId },
      order: [["createdAt", "DESC"]],
    });

    res.json({ monitors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMonitor = async (req, res) => {
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

    res.json({ monitor });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateMonitor = async (req, res) => {
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

    const allowedFields = [
      "name", "url", "method", "headers", "body",
      "intervalSeconds", "timeoutMs", "expectedStatus",
      "status", "tags",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        monitor[field] = req.body[field];
      }
    });

    await monitor.save();
    res.json({ monitor });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteMonitor = async (req, res) => {
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

    await Check.destroy({ where: { monitorId: monitor.id } });
    await Incident.destroy({ where: { monitorId: monitor.id } });
    await monitor.destroy();

    res.json({ message: "Monitor deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMonitorChecks = async (req, res) => {
  try {
    const { period } = req.query;
    let since = new Date();

    switch (period) {
      case "24h":
        since.setHours(since.getHours() - 24);
        break;
      case "7d":
        since.setDate(since.getDate() - 7);
        break;
      case "30d":
        since.setDate(since.getDate() - 30);
        break;
      case "90d":
        since.setDate(since.getDate() - 90);
        break;
      default:
        since.setHours(since.getHours() - 24);
    }

    const checks = await Check.findAll({
      where: {
        monitorId: req.params.id,
        checkedAt: { [Op.gte]: since },
      },
      order: [["checkedAt", "ASC"]],
    });

    res.json({ checks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMonitorIncidents = async (req, res) => {
  try {
    const incidents = await Incident.findAll({
      where: { monitorId: req.params.id },
      order: [["startedAt", "DESC"]],
      limit: 20,
    });

    res.json({ incidents });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createMonitor,
  getMonitors,
  getMonitor,
  updateMonitor,
  deleteMonitor,
  getMonitorChecks,
  getMonitorIncidents,
};
