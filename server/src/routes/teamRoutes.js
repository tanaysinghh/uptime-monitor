const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const {
  getTeamMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  getAuditLog,
} = require("../controllers/teamController");

router.use(authenticate);

router.get("/members", getTeamMembers);
router.post("/members", inviteMember);
router.put("/members/:id/role", updateMemberRole);
router.delete("/members/:id", removeMember);
router.get("/audit-log", getAuditLog);

module.exports = router;