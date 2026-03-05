const { Monitor, Check, Incident } = require("../models");
const { Op } = require("sequelize");
const sequelize = require("../config/database");

const calculatePercentile = (sortedValues, percentile) => {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)];
};

const getDashboardStats = async (req, res) => {
  try {
    const orgId = req.user.organizationId;

    const monitors = await Monitor.findAll({
      where: { organizationId: orgId },
    });

    const totalMonitors = monitors.length;
    const monitorsUp = monitors.filter((m) => m.status === "up").length;
    const monitorsDown = monitors.filter((m) => m.status === "down").length;
    const monitorsPaused = monitors.filter((m) => m.status === "paused").length;
    const monitorsInMaintenance = monitors.filter((m) => m.maintenanceMode).length;

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const monitorIds = monitors.map((m) => m.id);

    const recentChecks = await Check.findAll({
      where: {
        monitorId: { [Op.in]: monitorIds },
        checkedAt: { [Op.gte]: twentyFourHoursAgo },
      },
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "totalChecks"],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal('CASE WHEN "isSuccess" = true THEN 1 ELSE 0 END')
          ),
          "successfulChecks",
        ],
        [
          sequelize.fn("AVG", sequelize.col("responseTimeMs")),
          "avgResponseTime",
        ],
      ],
      raw: true,
    });

    const responseTimes = await Check.findAll({
      where: {
        monitorId: { [Op.in]: monitorIds },
        checkedAt: { [Op.gte]: twentyFourHoursAgo },
        responseTimeMs: { [Op.ne]: null },
      },
      attributes: ["responseTimeMs"],
      order: [["responseTimeMs", "ASC"]],
      raw: true,
    });

    const sortedTimes = responseTimes.map((r) => r.responseTimeMs);
    const p95 = calculatePercentile(sortedTimes, 95);
    const p99 = calculatePercentile(sortedTimes, 99);

    const activeIncidents = await Incident.findAll({
      where: {
        monitorId: { [Op.in]: monitorIds },
        status: { [Op.ne]: "resolved" },
      },
      include: [{ model: Monitor, attributes: ["name", "url"] }],
      order: [["startedAt", "DESC"]],
    });

    const stats = recentChecks[0] || {};
    const totalChecks = parseInt(stats.totalChecks) || 0;
    const successfulChecks = parseInt(stats.successfulChecks) || 0;
    const uptimePercentage =
      totalChecks > 0
        ? ((successfulChecks / totalChecks) * 100).toFixed(2)
        : 100;

    res.json({
      totalMonitors,
      monitorsUp,
      monitorsDown,
      monitorsPaused,
      monitorsInMaintenance,
      totalChecks,
      uptimePercentage: parseFloat(uptimePercentage),
      avgResponseTime: Math.round(parseFloat(stats.avgResponseTime) || 0),
      p95ResponseTime: p95,
      p99ResponseTime: p99,
      activeIncidents,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMonitorStats = async (req, res) => {
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

    const periods = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      "90d": 90 * 24 * 60 * 60 * 1000,
    };

    const period = req.query.period || "24h";
    const since = new Date(Date.now() - (periods[period] || periods["24h"]));

    const checks = await Check.findAll({
      where: {
        monitorId: monitor.id,
        checkedAt: { [Op.gte]: since },
      },
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("id")), "totalChecks"],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal('CASE WHEN "isSuccess" = true THEN 1 ELSE 0 END')
          ),
          "successfulChecks",
        ],
        [
          sequelize.fn("AVG", sequelize.col("responseTimeMs")),
          "avgResponseTime",
        ],
        [
          sequelize.fn("MAX", sequelize.col("responseTimeMs")),
          "maxResponseTime",
        ],
        [
          sequelize.fn("MIN", sequelize.col("responseTimeMs")),
          "minResponseTime",
        ],
      ],
      raw: true,
    });

    const responseTimes = await Check.findAll({
      where: {
        monitorId: monitor.id,
        checkedAt: { [Op.gte]: since },
        responseTimeMs: { [Op.ne]: null },
      },
      attributes: ["responseTimeMs"],
      order: [["responseTimeMs", "ASC"]],
      raw: true,
    });

    const sortedTimes = responseTimes.map((r) => r.responseTimeMs);
    const p95 = calculatePercentile(sortedTimes, 95);
    const p99 = calculatePercentile(sortedTimes, 99);

    const stats = checks[0] || {};
    const totalChecks = parseInt(stats.totalChecks) || 0;
    const successfulChecks = parseInt(stats.successfulChecks) || 0;
    const uptimePercentage =
      totalChecks > 0
        ? ((successfulChecks / totalChecks) * 100).toFixed(2)
        : 100;

    const incidents = await Incident.findAll({
      where: {
        monitorId: monitor.id,
        startedAt: { [Op.gte]: since },
      },
      order: [["startedAt", "DESC"]],
    });

    res.json({
      monitor,
      period,
      totalChecks,
      uptimePercentage: parseFloat(uptimePercentage),
      avgResponseTime: Math.round(parseFloat(stats.avgResponseTime) || 0),
      maxResponseTime: parseInt(stats.maxResponseTime) || 0,
      minResponseTime: parseInt(stats.minResponseTime) || 0,
      p95ResponseTime: p95,
      p99ResponseTime: p99,
      totalIncidents: incidents.length,
      incidents,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getDashboardStats, getMonitorStats };