const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const { requireEditor } = require("../middlewares/rbac");
const { validate } = require("../middlewares/validate");
const {
  monitorValidator,
  monitorUpdateValidator,
  uuidParam,
} = require("../middlewares/validators");
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
router.get("/:id", uuidParam(), validate, getMonitor);
router.get("/:id/checks", uuidParam(), validate, getMonitorChecks);
router.get("/:id/incidents", uuidParam(), validate, getMonitorIncidents);

router.post("/", requireEditor, monitorValidator, validate, createMonitor);
router.put("/:id", requireEditor, uuidParam(), monitorUpdateValidator, validate, updateMonitor);
router.delete("/:id", requireEditor, uuidParam(), validate, deleteMonitor);

module.exports = router;
