const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const { requireEditor } = require("../middlewares/rbac");
const { enableMaintenance, disableMaintenance } = require("../controllers/maintenanceController");

router.use(authenticate, requireEditor);

router.post("/monitors/:id/enable", enableMaintenance);
router.post("/monitors/:id/disable", disableMaintenance);

module.exports = router;