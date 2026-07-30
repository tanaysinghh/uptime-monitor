const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const sequelize = require("./config/database");
const logger = require("./utils/logger");
const { requestId } = require("./middlewares/requestId");

const authRoutes = require("./routes/authRoutes");
const monitorRoutes = require("./routes/monitorRoutes");
const statsRoutes = require("./routes/statsRoutes");
const publicRoutes = require("./routes/publicRoutes");
const alertRoutes = require("./routes/alertRoutes");
const teamRoutes = require("./routes/teamRoutes");
const apiKeyRoutes = require("./routes/apiKeyRoutes");
const heartbeatRoutes = require("./routes/heartbeatRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes");
const subscriberRoutes = require("./routes/subscriberRoutes");
const securityRoutes = require("./routes/securityRoutes");

const app = express();
const isProd = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

morgan.token("id", (req) => req.id);

app.use(requestId);
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(
  morgan(
    isProd
      ? ':remote-addr :id :method :url :status :res[content-length] - :response-time ms'
      : ':method :url :status :response-time ms - :id'
  )
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (req, res) => {
  const started = Date.now();
  let dbOk = false;
  let dbError = null;
  try {
    await sequelize.query("SELECT 1");
    dbOk = true;
  } catch (err) {
    dbError = err.message;
  }
  const status = dbOk ? 200 : 503;
  res.status(status).json({
    status: dbOk ? "ok" : "degraded",
    db: dbOk ? "ok" : "down",
    dbError: dbOk ? undefined : (isProd ? "unavailable" : dbError),
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    checkTimeMs: Date.now() - started,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/monitors", monitorRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/api-keys", apiKeyRoutes);
app.use("/api/heartbeat", heartbeatRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/public", subscriberRoutes);
app.use("/api/security", securityRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  logger.error("unhandled request error", {
    reqId: req.id,
    path: req.originalUrl,
    method: req.method,
    stack: err && err.stack ? err.stack : String(err),
  });
  const status = err.status || err.statusCode || 500;
  const message = isProd
    ? status >= 500
      ? "Internal server error"
      : err.message || "Request failed"
    : err.message || String(err);
  res.status(status).json({ error: message, requestId: req.id });
});

module.exports = app;
