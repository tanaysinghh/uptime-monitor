const express = require("express");
const router = express.Router();
const { getPublicStatus } = require("../controllers/publicController");
const { getStatusBadge, getUptimeBadge } = require("../controllers/badgeController");
const { publicLimiter } = require("../middlewares/rateLimiters");

router.get("/status/:slug", publicLimiter, getPublicStatus);
router.get("/status/:slug/badge.svg", publicLimiter, getStatusBadge);
router.get("/status/:slug/uptime.svg", publicLimiter, getUptimeBadge);

module.exports = router;