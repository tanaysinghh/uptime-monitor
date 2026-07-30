const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const { requireEditor } = require("../middlewares/rbac");
const { validate } = require("../middlewares/validate");
const { uuidParam, maintenanceValidator } = require("../middlewares/validators");
const { enableMaintenance, disableMaintenance } = require("../controllers/maintenanceController");

router.use(authenticate, requireEditor);

router.post(
  "/monitors/:id/enable",
  uuidParam(),
  maintenanceValidator,
  validate,
  enableMaintenance
);
router.post("/monitors/:id/disable", uuidParam(), validate, disableMaintenance);

module.exports = router;