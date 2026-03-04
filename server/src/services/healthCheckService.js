const axios = require("axios");
const { Monitor, Check, Incident } = require("../models");
const { Op } = require("sequelize");

const FAILURE_THRESHOLD = 3;

const performCheck = async (monitor) => {
  const startTime = Date.now();
  let statusCode = null;
  let isSuccess = false;
  let errorMessage = null;

  try {
    const response = await axios({
      method: monitor.method,
      url: monitor.url,
      headers: monitor.headers || {},
      data: monitor.body || undefined,
      timeout: monitor.timeoutMs,
      validateStatus: () => true,
    });

    statusCode = response.status;
    isSuccess = statusCode === monitor.expectedStatus;

    if (!isSuccess) {
      errorMessage = `Expected status ${monitor.expectedStatus}, got ${statusCode}`;
    }
  } catch (error) {
    isSuccess = false;
    if (error.code === "ECONNABORTED") {
      errorMessage = `Timeout after ${monitor.timeoutMs}ms`;
    } else if (error.code === "ENOTFOUND") {
      errorMessage = `DNS lookup failed for ${monitor.url}`;
    } else if (error.code === "ECONNREFUSED") {
      errorMessage = `Connection refused by ${monitor.url}`;
    } else {
      errorMessage = error.message;
    }
  }

  const responseTimeMs = Date.now() - startTime;

  const check = await Check.create({
    monitorId: monitor.id,
    statusCode,
    responseTimeMs,
    isSuccess,
    errorMessage,
    checkedAt: new Date(),
  });

  await handleStatusChange(monitor, isSuccess);

  return check;
};

const handleStatusChange = async (monitor, isSuccess) => {
  if (isSuccess) {
    if (monitor.status === "down") {
      const activeIncident = await Incident.findOne({
        where: {
          monitorId: monitor.id,
          status: { [Op.ne]: "resolved" },
        },
        order: [["startedAt", "DESC"]],
      });

      if (activeIncident) {
        const now = new Date();
        const duration = Math.floor(
          (now - activeIncident.startedAt) / 1000
        );
        activeIncident.status = "resolved";
        activeIncident.resolvedAt = now;
        activeIncident.durationSeconds = duration;
        await activeIncident.save();
      }
    }

    monitor.status = "up";
    monitor.consecutiveFailures = 0;
    monitor.lastCheckedAt = new Date();
    await monitor.save();
  } else {
    monitor.consecutiveFailures += 1;
    monitor.lastCheckedAt = new Date();

    if (monitor.consecutiveFailures >= FAILURE_THRESHOLD) {
      if (monitor.status !== "down") {
        monitor.status = "down";

        await Incident.create({
          monitorId: monitor.id,
          status: "investigating",
          startedAt: new Date(),
        });
      }
    }

    await monitor.save();
  }
};

const checkAllMonitors = async () => {
  const monitors = await Monitor.findAll({
    where: {
      status: { [Op.ne]: "paused" },
    },
  });

  const now = Date.now();

  for (const monitor of monitors) {
    const lastCheck = monitor.lastCheckedAt
      ? new Date(monitor.lastCheckedAt).getTime()
      : 0;
    const elapsed = (now - lastCheck) / 1000;

    if (elapsed >= monitor.intervalSeconds) {
      try {
        await performCheck(monitor);
      } catch (error) {
        console.error(`Error checking monitor ${monitor.id}:`, error.message);
      }
    }
  }
};

module.exports = { performCheck, checkAllMonitors };
