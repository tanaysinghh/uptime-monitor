const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const { getDashboardStats, getMonitorStats } = require("../controllers/statsController");

router.use(authenticate);

router.get("/dashboard", getDashboardStats);
router.get("/monitors/:id", getMonitorStats);

module.exports = router;