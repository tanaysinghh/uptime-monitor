const axios = require("axios");
const https = require("https");
const tls = require("tls");
const { URL } = require("url");
const { Monitor, Check, Incident, Organization } = require("../models");
const { Op } = require("sequelize");
const { emitMonitorUpdate, emitIncidentUpdate, emitCheckResult } = require("./socketService");

const FAILURE_THRESHOLD = 3;

const checkSSLCertificate = (hostname) => {
  return new Promise((resolve) => {
    try {
      const socket = tls.connect(443, hostname, { servername: hostname }, () => {
        const cert = socket.getPeerCertificate();
        socket.end();

        if (!cert || !cert.valid_to) {
          resolve(null);
          return;
        }

        const expiryDate = new Date(cert.valid_to);
        const now = new Date();
        const daysUntilExpiry = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));

        resolve({
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          daysUntilExpiry,
          issuer: cert.issuer?.O || "Unknown",
          isExpiringSoon: daysUntilExpiry <= 14,
        });
      });

      socket.on("error", () => resolve(null));
      socket.setTimeout(5000, () => {
        socket.destroy();
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
};

const performCheck = async (monitor) => {
  const startTime = Date.now();
  let statusCode = null;
  let isSuccess = false;
  let errorMessage = null;
  let sslInfo = null;

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

  try {
    const urlObj = new URL(monitor.url);
    if (urlObj.protocol === "https:") {
      sslInfo = await checkSSLCertificate(urlObj.hostname);
    }
  } catch {
    sslInfo = null;
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

  emitCheckResult(monitor.organizationId, {
    monitorId: monitor.id,
    statusCode,
    responseTimeMs,
    isSuccess,
    errorMessage,
    checkedAt: check.checkedAt,
    sslInfo,
  });

  return check;
};

const handleStatusChange = async (monitor, isSuccess) => {
  const previousStatus = monitor.status;

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
        const duration = Math.floor((now - activeIncident.startedAt) / 1000);
        activeIncident.status = "resolved";
        activeIncident.resolvedAt = now;
        activeIncident.durationSeconds = duration;
        await activeIncident.save();

        const org = await Organization.findByPk(monitor.organizationId);
        emitIncidentUpdate(monitor.organizationId, org?.slug, {
          type: "resolved",
          incident: activeIncident,
          monitorName: monitor.name,
        });
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

        const incident = await Incident.create({
          monitorId: monitor.id,
          status: "investigating",
          startedAt: new Date(),
        });

        const org = await Organization.findByPk(monitor.organizationId);
        emitIncidentUpdate(monitor.organizationId, org?.slug, {
          type: "new",
          incident,
          monitorName: monitor.name,
        });
      }
    }

    await monitor.save();
  }

  if (previousStatus !== monitor.status) {
    emitMonitorUpdate(monitor.organizationId, {
      monitorId: monitor.id,
      name: monitor.name,
      previousStatus,
      currentStatus: monitor.status,
    });
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

module.exports = { performCheck, checkAllMonitors, checkSSLCertificate };
