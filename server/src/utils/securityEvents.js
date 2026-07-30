const { SecurityEvent } = require("../models");
const logger = require("./logger");

const record = async ({ userId, organizationId = null, eventType, req, metadata = {} }) => {
  try {
    await SecurityEvent.create({
      userId,
      organizationId,
      eventType,
      ipAddress: req ? req.ip : null,
      userAgent: req ? String(req.headers["user-agent"] || "").slice(0, 500) : null,
      metadata,
    });
  } catch (err) {
    logger.error("failed to record security event", { eventType, userId, error: err.message });
  }
};

module.exports = { record };
