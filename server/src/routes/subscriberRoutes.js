const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const { subscribe, unsubscribe, getSubscribers } = require("../controllers/subscriberController");

router.post("/status/:slug/subscribe", subscribe);
router.get("/unsubscribe/:token", unsubscribe);
router.get("/subscribers", authenticate, getSubscribers);

module.exports = router;