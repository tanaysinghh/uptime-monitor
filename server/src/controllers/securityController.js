const { SecurityEvent } = require("../models");
const { handleError } = require("../utils/errorResponse");

const getMyEvents = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const events = await SecurityEvent.findAll({
      where: { userId: req.user.id },
      order: [["createdAt", "DESC"]],
      limit,
      attributes: ["id", "eventType", "ipAddress", "userAgent", "metadata", "createdAt"],
    });
    res.json({ events });
  } catch (err) {
    handleError(res, err);
  }
};

module.exports = { getMyEvents };
