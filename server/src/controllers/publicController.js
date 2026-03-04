const { Organization, Monitor, Check, Incident } = require("../models");
const { Op } = require("sequelize");
const sequelize = require("../config/database");

const getPublicStatus = async (req, res) => {
  try {
    const { slug } = req.params;

    const organization = await Organization.findOne({ where: { slug } });

    if (!organization) {
      return res.status(404).json({ error: "Status page not found" });
    }

    const monitors = await Monitor.findAll({
      where: {
        organizationId: organization.id,
        status: { [Op.ne]: "paused" },
      },
      attributes: ["id", "name", "status", "lastCheckedAt"],
      order: [["name", "ASC"]],
    });

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const monitorIds = monitors.map((m) => m.id);

    const monitorsWithUptime = await Promise.all(
      monitors.map(async (monitor) => {
        const dailyStats = await Check.findAll({
          where: {
            monitorId: monitor.id,
            checkedAt: { [Op.gte]: ninetyDaysAgo },
          },
          attributes: [
            [sequelize.fn("DATE", sequelize.col("checkedAt")), "date"],
            [sequelize.fn("COUNT", sequelize.col("id")), "total"],
            [
              sequelize.fn(
                "SUM",
                sequelize.literal('CASE WHEN "isSuccess" = true THEN 1 ELSE 0 END')
              ),
              "successful",
            ],
          ],
          group: [sequelize.fn("DATE", sequelize.col("checkedAt"))],
          order: [[sequelize.fn("DATE", sequelize.col("checkedAt")), "ASC"]],
          raw: true,
        });

        const uptimeDays = dailyStats.map((day) => ({
          date: day.date,
          uptimePercentage:
            day.total > 0
              ? parseFloat(((day.successful / day.total) * 100).toFixed(2))
              : 100,
        }));

        const totalChecks = dailyStats.reduce((sum, d) => sum + parseInt(d.total), 0);
        const totalSuccess = dailyStats.reduce((sum, d) => sum + parseInt(d.successful), 0);
        const overallUptime =
          totalChecks > 0
            ? parseFloat(((totalSuccess / totalChecks) * 100).toFixed(2))
            : 100;

        return {
          id: monitor.id,
          name: monitor.name,
          status: monitor.status,
          lastCheckedAt: monitor.lastCheckedAt,
          overallUptime,
          uptimeDays,
        };
      })
    );

    const activeIncidents = await Incident.findAll({
      where: {
        monitorId: { [Op.in]: monitorIds },
        status: { [Op.ne]: "resolved" },
      },
      include: [{ model: Monitor, attributes: ["name"] }],
      order: [["startedAt", "DESC"]],
    });

    const recentIncidents = await Incident.findAll({
      where: {
        monitorId: { [Op.in]: monitorIds },
        status: "resolved",
      },
      include: [{ model: Monitor, attributes: ["name"] }],
      order: [["startedAt", "DESC"]],
      limit: 10,
    });

    const allUp = monitors.every((m) => m.status === "up");
    const allDown = monitors.every((m) => m.status === "down");
    let overallStatus = "operational";
    if (allDown) overallStatus = "major_outage";
    else if (!allUp) overallStatus = "partial_outage";

    res.json({
      organization: {
        name: organization.name,
        slug: organization.slug,
        logoUrl: organization.logoUrl,
        brandColor: organization.brandColor,
      },
      overallStatus,
      monitors: monitorsWithUptime,
      activeIncidents,
      recentIncidents,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getPublicStatus };