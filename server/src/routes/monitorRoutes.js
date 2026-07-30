const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const { requireEditor } = require("../middlewares/rbac");
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

router.get("/", getMonitors);
router.get("/:id", getMonitor);
router.get("/:id/checks", getMonitorChecks);
router.get("/:id/incidents", getMonitorIncidents);

router.post("/", requireEditor, createMonitor);
router.put("/:id", requireEditor, updateMonitor);
router.delete("/:id", requireEditor, deleteMonitor);

module.exports = router;
