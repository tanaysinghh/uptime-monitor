const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const {
  createMonitor,
  getMonitors,
  getMonitor,
  updateMonitor,
  deleteMonitor,
  getMonitorChecks,
  getMonitorIncidents,
} = require("../controllers/monitorController");

router.use(authenticate);

router.post("/", createMonitor);
router.get("/", getMonitors);
router.get("/:id", getMonitor);
router.put("/:id", updateMonitor);
router.delete("/:id", deleteMonitor);
router.get("/:id/checks", getMonitorChecks);
router.get("/:id/incidents", getMonitorIncidents);

module.exports = router;
