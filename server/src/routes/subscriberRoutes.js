const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const { subscribeLimiter } = require("../middlewares/rateLimiters");
const { validate } = require("../middlewares/validate");
const { subscribeValidator } = require("../middlewares/validators");
const { subscribe, unsubscribe, getSubscribers } = require("../controllers/subscriberController");

router.post(
  "/status/:slug/subscribe",
  subscribeLimiter,
  subscribeValidator,
  validate,
  subscribe
);
router.get("/unsubscribe/:token", unsubscribe);
router.get("/subscribers", authenticate, getSubscribers);

module.exports = router;