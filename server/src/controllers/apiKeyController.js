const { ApiKey, AuditLog } = require("../models");

const getApiKeys = async (req, res) => {
  try {
    const keys = await ApiKey.findAll({
      where: { organizationId: req.user.organizationId },
      attributes: { exclude: ["keyHash"] },
      order: [["createdAt", "DESC"]],
    });
    res.json({ keys });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createApiKey = async (req, res) => {
  try {
    const { name, permissions, expiresAt } = req.body;

    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can create API keys" });
    }

    const { key, hash, prefix } = ApiKey.generateKey();

    const apiKey = await ApiKey.create({
      organizationId: req.user.organizationId,
      userId: req.user.id,
      name,
      keyHash: hash,
      keyPrefix: prefix,
      permissions: permissions || ["read"],
      expiresAt: expiresAt || null,
    });

    await AuditLog.create({
      organizationId: req.user.organizationId,
      userId: req.user.id,
      action: "create_api_key",
      resource: "api_key",
      resourceId: apiKey.id,
      details: { name, permissions: permissions || ["read"] },
      ipAddress: req.ip,
    });

    res.status(201).json({
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        permissions: apiKey.permissions,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      },
      key,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const revokeApiKey = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admins can revoke API keys" });
    }

    const apiKey = await ApiKey.findOne({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
      },
    });

    if (!apiKey) {
      return res.status(404).json({ error: "API key not found" });
    }

    apiKey.isActive = false;
    await apiKey.save();

    await AuditLog.create({
      organizationId: req.user.organizationId,
      userId: req.user.id,
      action: "revoke_api_key",
      resource: "api_key",
      resourceId: apiKey.id,
      details: { name: apiKey.name },
      ipAddress: req.ip,
    });

    res.json({ message: "API key revoked" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getApiKeys, createApiKey, revokeApiKey };