const { User, Organization, AuditLog } = require("../models");
const bcrypt = require("bcryptjs");

const getTeamMembers = async (req, res) => {
  try {
    const members = await User.findAll({
      where: { organizationId: req.user.organizationId },
      attributes: { exclude: ["password"] },
      order: [["createdAt", "ASC"]],
    });
    res.json({ members });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const inviteMember = async (req, res) => {
  try {
    const { email, name, password, role } = req.body;

    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can invite members" });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const user = await User.create({
      email,
      name,
      password,
      role: role || "viewer",
      organizationId: req.user.organizationId,
      isVerified: true,
    });

    await AuditLog.create({
      organizationId: req.user.organizationId,
      userId: req.user.id,
      action: "invite_member",
      resource: "user",
      resourceId: user.id,
      details: { email, role: role || "viewer" },
      ipAddress: req.ip,
    });

    res.status(201).json({
      member: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateMemberRole = async (req, res) => {
  try {
    const { role } = req.body;

    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can change roles" });
    }

    const member = await User.findOne({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
      },
    });

    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    if (member.id === req.user.id) {
      return res.status(400).json({ error: "Cannot change your own role" });
    }

    const oldRole = member.role;
    member.role = role;
    await member.save();

    await AuditLog.create({
      organizationId: req.user.organizationId,
      userId: req.user.id,
      action: "update_role",
      resource: "user",
      resourceId: member.id,
      details: { oldRole, newRole: role },
      ipAddress: req.ip,
    });

    res.json({ member: { id: member.id, email: member.email, name: member.name, role: member.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const removeMember = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can remove members" });
    }

    const member = await User.findOne({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
      },
    });

    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    if (member.id === req.user.id) {
      return res.status(400).json({ error: "Cannot remove yourself" });
    }

    await AuditLog.create({
      organizationId: req.user.organizationId,
      userId: req.user.id,
      action: "remove_member",
      resource: "user",
      resourceId: member.id,
      details: { email: member.email, name: member.name },
      ipAddress: req.ip,
    });

    await member.destroy();
    res.json({ message: "Member removed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAuditLog = async (req, res) => {
  try {
    const logs = await AuditLog.findAll({
      where: { organizationId: req.user.organizationId },
      include: [{ model: User, attributes: ["name", "email"] }],
      order: [["createdAt", "DESC"]],
      limit: 100,
    });
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getTeamMembers, inviteMember, updateMemberRole, removeMember, getAuditLog };