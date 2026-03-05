const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const { enableMaintenance, disableMaintenance } = require("../controllers/maintenanceController");

router.use(authenticate);

router.post("/monitors/:id/enable", enableMaintenance);
router.post("/monitors/:id/disable", disableMaintenance);

module.exports = router;