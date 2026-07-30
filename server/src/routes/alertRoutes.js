const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const { requireEditor } = require("../middlewares/rbac");
const {
  getChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  testChannel,
  getAlertLogs,
} = require("../controllers/alertController");

router.use(authenticate);

router.get("/channels", getChannels);
router.get("/logs", getAlertLogs);

router.post("/channels", requireEditor, createChannel);
router.put("/channels/:id", requireEditor, updateChannel);
router.delete("/channels/:id", requireEditor, deleteChannel);
router.post("/channels/:id/test", requireEditor, testChannel);

module.exports = router;