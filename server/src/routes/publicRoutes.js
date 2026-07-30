const express = require("express");
const router = express.Router();
const { getPublicStatus } = require("../controllers/publicController");
const { publicLimiter } = require("../middlewares/rateLimiters");

router.get("/status/:slug", publicLimiter, getPublicStatus);

module.exports = router;