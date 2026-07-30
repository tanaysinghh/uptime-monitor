const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const { getMyEvents } = require("../controllers/securityController");

router.use(authenticate);
router.get("/events", getMyEvents);

module.exports = router;
