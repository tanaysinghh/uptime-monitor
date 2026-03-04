const cron = require("node-cron");
const { checkAllMonitors } = require("./healthCheckService");
const { startCleanup } = require("./dataCleanup");

let schedulerTask = null;

const startScheduler = () => {
  console.log("Health check scheduler started");

  schedulerTask = cron.schedule("*/30 * * * * *", async () => {
    try {
      await checkAllMonitors();
    } catch (error) {
      console.error("Scheduler error:", error.message);
    }
  });

  startCleanup();
};

const stopScheduler = () => {
  if (schedulerTask) {
    schedulerTask.stop();
    console.log("Health check scheduler stopped");
  }
};

module.exports = { startScheduler, stopScheduler };
