require("dotenv").config();

const { validateEnv } = require("./config/env");
const env = validateEnv();

const http = require("http");
const app = require("./app");
const { sequelize } = require("./models");
const { startScheduler } = require("./services/scheduler");
const { initSocket } = require("./services/socketService");

const server = http.createServer(app);

initSocket(server);

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected");

    if (env.isProd) {
      await sequelize.sync();
      console.log("Models synced (production: no schema alter)");
    } else {
      await sequelize.sync({ alter: true });
      console.log("Models synced (dev: alter=true)");
    }

    startScheduler();

    server.listen(env.port, () => {
      console.log(`Server running on port ${env.port} [${env.nodeEnv}]`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

start();