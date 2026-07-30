const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

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

const app = express();
const isProd = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(morgan(isProd ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  console.error("[unhandled]", err && err.stack ? err.stack : err);
  const status = err.status || err.statusCode || 500;
  const message = isProd
    ? status >= 500
      ? "Internal server error"
      : err.message || "Request failed"
    : err.message || String(err);
  res.status(status).json({ error: message });
});

module.exports = app;
