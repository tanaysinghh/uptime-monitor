const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
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
router.post("/channels", createChannel);
router.put("/channels/:id", updateChannel);
router.delete("/channels/:id", deleteChannel);
router.post("/channels/:id/test", testChannel);
router.get("/logs", getAlertLogs);

module.exports = router;