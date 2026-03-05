const { AlertChannel, AlertLog, Monitor } = require("../models");

const getChannels = async (req, res) => {
  try {
    const channels = await AlertChannel.findAll({
      where: { organizationId: req.user.organizationId },
      order: [["createdAt", "DESC"]],
    });
    res.json({ channels });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createChannel = async (req, res) => {
  try {
    const { name, type, config, cooldownMinutes } = req.body;

    const channel = await AlertChannel.create({
      organizationId: req.user.organizationId,
      name,
      type,
      config,
      cooldownMinutes: cooldownMinutes || 5,
    });

    res.status(201).json({ channel });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateChannel = async (req, res) => {
  try {
    const channel = await AlertChannel.findOne({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
      },
    });

    if (!channel) {
      return res.status(404).json({ error: "Alert channel not found" });
    }

    const allowedFields = ["name", "type", "config", "isActive", "cooldownMinutes"];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        channel[field] = req.body[field];
      }
    });

    await channel.save();
    res.json({ channel });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteChannel = async (req, res) => {
  try {
    const channel = await AlertChannel.findOne({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
      },
    });

    if (!channel) {
      return res.status(404).json({ error: "Alert channel not found" });
    }

    await AlertLog.destroy({ where: { channelId: channel.id } });
    await channel.destroy();
    res.json({ message: "Alert channel deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const testChannel = async (req, res) => {
  try {
    const channel = await AlertChannel.findOne({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
      },
    });

    if (!channel) {
      return res.status(404).json({ error: "Alert channel not found" });
    }

    const axios = require("axios");
    const testPayload = {
      event: "test",
      monitor: { name: "Test Monitor", url: "https://example.com", status: "down" },
      timestamp: new Date().toISOString(),
      message: "This is a test alert from UptimeMonitor",
    };

    switch (channel.type) {
      case "webhook":
        await axios.post(channel.config.url, testPayload, { timeout: 10000 });
        break;
      case "slack":
        await axios.post(channel.config.webhookUrl, {
          text: ":test_tube: Test alert from UptimeMonitor - your alert channel is working!",
        }, { timeout: 10000 });
        break;
      case "discord":
        await axios.post(channel.config.webhookUrl, {
          content: "🧪 Test alert from UptimeMonitor - your alert channel is working!",
        }, { timeout: 10000 });
        break;
    }

    res.json({ message: "Test alert sent successfully" });
  } catch (error) {
    res.status(500).json({ error: "Test failed: " + error.message });
  }
};

const getAlertLogs = async (req, res) => {
  try {
    const monitorIds = await Monitor.findAll({
      where: { organizationId: req.user.organizationId },
      attributes: ["id"],
      raw: true,
    });

    const logs = await AlertLog.findAll({
      where: { monitorId: monitorIds.map((m) => m.id) },
      include: [
        { model: Monitor, attributes: ["name"] },
        { model: AlertChannel, attributes: ["name", "type"] },
      ],
      order: [["sentAt", "DESC"]],
      limit: 50,
    });

    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getChannels, createChannel, updateChannel, deleteChannel, testChannel, getAlertLogs };