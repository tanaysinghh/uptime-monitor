const http = require("http");
const app = require("./app");
const { sequelize } = require("./models");
const { startScheduler } = require("./services/scheduler");

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected");

    await sequelize.sync({ alter: true });
    console.log("Models synced");

    startScheduler();

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

start();
