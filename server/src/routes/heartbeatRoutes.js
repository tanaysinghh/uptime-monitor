const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const { requireEditor } = require("../middlewares/rbac");
const { heartbeatLimiter } = require("../middlewares/rateLimiters");
const { validate } = require("../middlewares/validate");
const { heartbeatCreateValidator } = require("../middlewares/validators");
const { createHeartbeatMonitor, receiveHeartbeat } = require("../services/heartbeatService");

router.post(
  "/monitors",
  authenticate,
  requireEditor,
  heartbeatCreateValidator,
  validate,
  createHeartbeatMonitor
);
router.get("/:token", heartbeatLimiter, receiveHeartbeat);
router.post("/:token", heartbeatLimiter, receiveHeartbeat);

module.exports = router;