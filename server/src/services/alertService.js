const axios = require("axios");
const { AlertChannel, AlertLog } = require("../models");
const { Op } = require("sequelize");

const sendAlert = async (monitor, incident, alertType) => {
  const channels = await AlertChannel.findAll({
    where: {
      organizationId: monitor.organizationId,
      isActive: true,
    },
  });

  for (const channel of channels) {
    const now = new Date();
    if (channel.lastAlertedAt) {
      const cooldownMs = channel.cooldownMinutes * 60 * 1000;
      if (now - new Date(channel.lastAlertedAt) < cooldownMs) {
        continue;
      }
    }

    try {
      switch (channel.type) {
        case "webhook":
          await sendWebhook(channel, monitor, incident, alertType);
          break;
        case "slack":
          await sendSlack(channel, monitor, incident, alertType);
          break;
        case "discord":
          await sendDiscord(channel, monitor, incident, alertType);
          break;
        case "email":
          break;
      }

      channel.lastAlertedAt = now;
      await channel.save();

      await AlertLog.create({
        monitorId: monitor.id,
        incidentId: incident?.id || null,
        channelId: channel.id,
        type: alertType,
        status: "sent",
        sentAt: now,
      });
    } catch (error) {
      await AlertLog.create({
        monitorId: monitor.id,
        incidentId: incident?.id || null,
        channelId: channel.id,
        type: alertType,
        status: "failed",
        errorMessage: error.message,
        sentAt: now,
      });
    }
  }
};

const sendWebhook = async (channel, monitor, incident, alertType) => {
  const payload = {
    event: alertType,
    monitor: {
      id: monitor.id,
      name: monitor.name,
      url: monitor.url,
      status: monitor.status,
    },
    incident: incident
      ? {
          id: incident.id,
          status: incident.status,
          startedAt: incident.startedAt,
          resolvedAt: incident.resolvedAt,
        }
      : null,
    timestamp: new Date().toISOString(),
  };

  await axios.post(channel.config.url, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 10000,
  });
};

const sendSlack = async (channel, monitor, incident, alertType) => {
  const color = alertType === "up" ? "#10b981" : "#ef4444";
  const emoji = alertType === "up" ? ":white_check_mark:" : ":red_circle:";
  const statusText = alertType === "up" ? "is back UP" : "is DOWN";

  const payload = {
    attachments: [
      {
        color,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: emoji + " *" + monitor.name + "* " + statusText,
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: "*URL:*\n" + monitor.url,
              },
              {
                type: "mrkdwn",
                text: "*Time:*\n" + new Date().toLocaleString(),
              },
            ],
          },
        ],
      },
    ],
  };

  await axios.post(channel.config.webhookUrl, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 10000,
  });
};

const sendDiscord = async (channel, monitor, incident, alertType) => {
  const color = alertType === "up" ? 1111296 : 15548997;
  const statusText = alertType === "up" ? "is back UP" : "is DOWN";
  const emoji = alertType === "up" ? "✅" : "🔴";

  const payload = {
    embeds: [
      {
        title: emoji + " " + monitor.name + " " + statusText,
        color,
        fields: [
          { name: "URL", value: monitor.url, inline: true },
          { name: "Time", value: new Date().toLocaleString(), inline: true },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  await axios.post(channel.config.webhookUrl, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 10000,
  });
};

module.exports = { sendAlert };