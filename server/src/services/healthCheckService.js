const axios = require("axios");
const tls = require("tls");
const { URL } = require("url");
const { Monitor, Check, Incident, Organization } = require("../models");
const { Op } = require("sequelize");
const { emitMonitorUpdate, emitIncidentUpdate, emitCheckResult } = require("./socketService");
const { evaluateAssertions } = require("../utils/assertions");

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
  if (monitor.maintenanceMode) {
    const now = new Date();
    if (monitor.maintenanceEndAt && now > new Date(monitor.maintenanceEndAt)) {
      monitor.maintenanceMode = false;
      monitor.maintenanceStartAt = null;
      monitor.maintenanceEndAt = null;
      monitor.maintenanceReason = null;
      await monitor.save();
    } else {
      return null;
    }
  }

  const startTime = Date.now();
  let statusCode = null;
  let isSuccess = false;
  let errorMessage = null;
  let sslInfo = null;
  let responseBody = null;
  let assertionResults = null;

  try {
    const response = await axios({
      method: monitor.method,
      url: monitor.url,
      headers: monitor.headers || {},
      data: monitor.body || undefined,
      timeout: monitor.timeoutMs,
      validateStatus: () => true,
      transformResponse: [(data) => data],
    });

    statusCode = response.status;
    responseBody = response.data;
    isSuccess = statusCode === monitor.expectedStatus;

    if (!isSuccess) {
      errorMessage = "Expected status " + monitor.expectedStatus + ", got " + statusCode;
    }

    if (monitor.assertions && monitor.assertions.length > 0) {
      const assertionCheck = evaluateAssertions(monitor.assertions, responseBody, statusCode);
      assertionResults = assertionCheck.results;

      if (!assertionCheck.passed) {
        isSuccess = false;
        const failedAssertions = assertionCheck.results
          .filter((r) => !r.passed)
          .map((r) => r.type + ": expected " + (r.value || "") + ", got " + (r.actual || ""))
          .join("; ");
        errorMessage = errorMessage
          ? errorMessage + " | Assertions failed: " + failedAssertions
          : "Assertions failed: " + failedAssertions;
      }
    }
  } catch (error) {
    isSuccess = false;
    if (error.code === "ECONNABORTED") {
      errorMessage = "Timeout after " + monitor.timeoutMs + "ms";
    } else if (error.code === "ENOTFOUND") {
      errorMessage = "DNS lookup failed for " + monitor.url;
    } else if (error.code === "ECONNREFUSED") {
      errorMessage = "Connection refused by " + monitor.url;
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

  if (monitor.assertions && monitor.assertions.length > 0) {
    const rtAssertions = monitor.assertions.filter((a) => a.type === "response_time");
    for (const rta of rtAssertions) {
      const passed = responseTimeMs <= parseInt(rta.value);
      if (!passed) {
        isSuccess = false;
        const rtMsg = "Response time " + responseTimeMs + "ms exceeds " + rta.value + "ms";
        errorMessage = errorMessage ? errorMessage + " | " + rtMsg : rtMsg;
      }
      if (assertionResults) {
        const idx = assertionResults.findIndex((r) => r.type === "response_time" && r.value === rta.value);
        if (idx !== -1) {
          assertionResults[idx].passed = passed;
          assertionResults[idx].actual = responseTimeMs + "ms";
        }
      }
    }
  }

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
    assertionResults,
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
      monitorType: "http",
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
        console.error("Error checking monitor " + monitor.id + ":", error.message);
      }
    }
  }
};

module.exports = { performCheck, checkAllMonitors, checkSSLCertificate };