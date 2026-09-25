const { Monitor, Check, Incident } = require("../models");
const { Op } = require("sequelize");
const { handleError } = require("../utils/errorResponse");
const { validateMonitorUrl } = require("../utils/ssrfGuard");
const sequelize = require("../config/database");

const createMonitor = async (req, res) => {
  try {
    const { name, url, method, headers, body, intervalSeconds, timeoutMs, expectedStatus, tags } = req.body;

    const urlCheck = await validateMonitorUrl(url);
    if (!urlCheck.ok) {
      return res.status(400).json({ error: urlCheck.reason });
    }

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
    handleError(res, error);
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
    handleError(res, error);
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
    handleError(res, error);
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

    if (req.body.url !== undefined && req.body.url !== monitor.url) {
      const urlCheck = await validateMonitorUrl(req.body.url);
      if (!urlCheck.ok) {
        return res.status(400).json({ error: urlCheck.reason });
      }
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
    handleError(res, error);
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

    await sequelize.transaction(async (t) => {
      await Check.destroy({ where: { monitorId: monitor.id }, transaction: t });
      await Incident.destroy({ where: { monitorId: monitor.id }, transaction: t });
      await monitor.destroy({ transaction: t });
    });

    res.json({ message: "Monitor deleted" });
  } catch (error) {
    handleError(res, error);
  }
};

// Checks and incidents are keyed by monitorId only, so the monitor itself must be verified
// to belong to the caller's organization. A foreign or unknown id yields an empty list,
// which reveals nothing about whether the monitor exists.
const ownsMonitor = async (req) => {
  const monitor = await Monitor.findOne({
    where: { id: req.params.id, organizationId: req.user.organizationId },
    attributes: ["id"],
  });
  return !!monitor;
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

    if (!(await ownsMonitor(req))) {
      return res.json({ checks: [] });
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
    handleError(res, error);
  }
};

const getMonitorIncidents = async (req, res) => {
  try {
    if (!(await ownsMonitor(req))) {
      return res.json({ incidents: [] });
    }

    const incidents = await Incident.findAll({
      where: { monitorId: req.params.id },
      order: [["startedAt", "DESC"]],
      limit: 20,
    });

    res.json({ incidents });
  } catch (error) {
    handleError(res, error);
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
