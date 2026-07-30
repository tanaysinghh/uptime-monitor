const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const { requireEditor } = require("../middlewares/rbac");
const { validate } = require("../middlewares/validate");
const { alertChannelValidator, uuidParam } = require("../middlewares/validators");
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

router.post("/channels", requireEditor, alertChannelValidator, validate, createChannel);
router.put("/channels/:id", requireEditor, uuidParam(), validate, updateChannel);
router.delete("/channels/:id", requireEditor, uuidParam(), validate, deleteChannel);
router.post("/channels/:id/test", requireEditor, uuidParam(), validate, testChannel);

module.exports = router;
