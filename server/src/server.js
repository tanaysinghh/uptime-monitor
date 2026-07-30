require("dotenv").config();

const { validateEnv } = require("./config/env");
const env = validateEnv();

const http = require("http");
const app = require("./app");
const { sequelize } = require("./models");
const { startScheduler, stopScheduler } = require("./services/scheduler");
const { initSocket } = require("./services/socketService");
const logger = require("./utils/logger");

const server = http.createServer(app);

const io = initSocket(server);

const start = async () => {
  try {
    await sequelize.authenticate();
    logger.info("Database connected");

    if (env.isProd) {
      await sequelize.sync();
      logger.info("Models synced (production: no schema alter)");
    } else {
      await sequelize.sync({ alter: true });
      logger.info("Models synced (dev: alter=true)");
    }

    startScheduler();

    server.listen(env.port, () => {
      logger.info(`Server running on port ${env.port} [${env.nodeEnv}]`);
    });
  } catch (error) {
    logger.error("Failed to start server", { error: error.message });
    process.exit(1);
  }
};

let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down gracefully`);

  const shutdownTimer = setTimeout(() => {
    logger.error("Shutdown timed out after 15s, forcing exit");
    process.exit(1);
  }, 15000);
  shutdownTimer.unref();

  try {
    stopScheduler();
    if (io) io.close();
    await new Promise((resolve) => server.close(resolve));
    await sequelize.close();
    logger.info("Shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error("Error during shutdown", { error: err.message });
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason: String(reason) });
});
process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", { error: err.message, stack: err.stack });
  shutdown("uncaughtException");
});

start();
