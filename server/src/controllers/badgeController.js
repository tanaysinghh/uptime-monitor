const { Organization, Monitor, Check } = require("../models");
const { Op } = require("sequelize");
const { handleError } = require("../utils/errorResponse");

const COLORS = {
  up: "#22c55e",
  down: "#ef4444",
  paused: "#6b7280",
  pending: "#9ca3af",
  unknown: "#9ca3af",
};

const LABEL_BG = "#555";

const escapeXml = (unsafe) =>
  String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const approxTextWidth = (text) => text.length * 6.5 + 12;

const renderBadge = (label, value, valueColor) => {
  const safeLabel = escapeXml(label);
  const safeValue = escapeXml(value);
  const labelW = Math.round(approxTextWidth(label));
  const valueW = Math.round(approxTextWidth(value));
  const totalW = labelW + valueW;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="20" role="img" aria-label="${safeLabel}: ${safeValue}">
  <title>${safeLabel}: ${safeValue}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${totalW}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="20" fill="${LABEL_BG}"/>
    <rect x="${labelW}" width="${valueW}" height="20" fill="${valueColor}"/>
    <rect width="${totalW}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelW / 2}" y="15" fill="#010101" fill-opacity=".3">${safeLabel}</text>
    <text x="${labelW / 2}" y="14">${safeLabel}</text>
    <text x="${labelW + valueW / 2}" y="15" fill="#010101" fill-opacity=".3">${safeValue}</text>
    <text x="${labelW + valueW / 2}" y="14">${safeValue}</text>
  </g>
</svg>`;
};

const sendSvg = (res, svg) => {
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
  res.status(200).send(svg);
};

const getStatusBadge = async (req, res) => {
  try {
    const { slug } = req.params;
    const org = await Organization.findOne({ where: { slug } });

    if (!org) {
      return sendSvg(res, renderBadge("status", "not found", COLORS.unknown));
    }

    const monitors = await Monitor.findAll({
      where: {
        organizationId: org.id,
        status: { [Op.ne]: "paused" },
      },
      attributes: ["status"],
    });

    if (monitors.length === 0) {
      return sendSvg(res, renderBadge("status", "no monitors", COLORS.unknown));
    }

    const allUp = monitors.every((m) => m.status === "up");
    const allDown = monitors.every((m) => m.status === "down");
    let label = "operational";
    let color = COLORS.up;
    if (allDown) {
      label = "major outage";
      color = COLORS.down;
    } else if (!allUp) {
      label = "partial outage";
      color = COLORS.down;
    }

    return sendSvg(res, renderBadge("status", label, color));
  } catch (err) {
    handleError(res, err);
  }
};

const getUptimeBadge = async (req, res) => {
  try {
    const { slug } = req.params;
    const period = req.query.period === "7d" ? 7 : req.query.period === "30d" ? 30 : 90;

    const org = await Organization.findOne({ where: { slug } });
    if (!org) {
      return sendSvg(res, renderBadge("uptime", "not found", COLORS.unknown));
    }

    const monitors = await Monitor.findAll({
      where: { organizationId: org.id, status: { [Op.ne]: "paused" } },
      attributes: ["id"],
    });
    const monitorIds = monitors.map((m) => m.id);
    if (monitorIds.length === 0) {
      return sendSvg(res, renderBadge("uptime", "n/a", COLORS.unknown));
    }

    const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
    const checks = await Check.findAll({
      where: {
        monitorId: { [Op.in]: monitorIds },
        checkedAt: { [Op.gte]: since },
      },
      attributes: ["isSuccess"],
      raw: true,
    });

    if (checks.length === 0) {
      return sendSvg(res, renderBadge(`uptime ${period}d`, "n/a", COLORS.unknown));
    }

    const success = checks.filter((c) => c.isSuccess).length;
    const pct = (success / checks.length) * 100;
    const pctStr = pct >= 99.99 ? "100%" : pct.toFixed(2) + "%";

    let color = COLORS.up;
    if (pct < 99) color = "#eab308";
    if (pct < 95) color = COLORS.down;

    return sendSvg(res, renderBadge(`uptime ${period}d`, pctStr, color));
  } catch (err) {
    handleError(res, err);
  }
};

module.exports = { getStatusBadge, getUptimeBadge };
