const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const { validate } = require("../middlewares/validate");
const { inviteValidator, updateRoleValidator, uuidParam } = require("../middlewares/validators");
const {
  getTeamMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  getAuditLog,
} = require("../controllers/teamController");

router.use(authenticate);

router.get("/members", getTeamMembers);
router.post("/members", inviteValidator, validate, inviteMember);
router.put("/members/:id/role", uuidParam(), updateRoleValidator, validate, updateMemberRole);
router.delete("/members/:id", uuidParam(), validate, removeMember);
router.get("/audit-log", getAuditLog);

module.exports = router;