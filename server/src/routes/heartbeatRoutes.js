const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const { createHeartbeatMonitor, receiveHeartbeat } = require("../services/heartbeatService");

router.post("/monitors", authenticate, createHeartbeatMonitor);
router.get("/:token", receiveHeartbeat);
router.post("/:token", receiveHeartbeat);

module.exports = router;