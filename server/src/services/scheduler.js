const cron = require("node-cron");
const { checkAllMonitors } = require("./healthCheckService");
const { checkHeartbeatMonitors } = require("./heartbeatService");
const { startCleanup } = require("./dataCleanup");

let schedulerTask = null;
let heartbeatTask = null;

const startScheduler = () => {
  console.log("Health check scheduler started");

  schedulerTask = cron.schedule("*/30 * * * * *", async () => {
    try {
      await checkAllMonitors();
    } catch (error) {
      console.error("Scheduler error:", error.message);
    }
  });

  heartbeatTask = cron.schedule("*/30 * * * * *", async () => {
    try {
      await checkHeartbeatMonitors();
    } catch (error) {
      console.error("Heartbeat checker error:", error.message);
    }
  });

  startCleanup();
};

const stopScheduler = () => {
  if (schedulerTask) {
    schedulerTask.stop();
    console.log("Health check scheduler stopped");
  }
  if (heartbeatTask) {
    heartbeatTask.stop();
  }
};

module.exports = { startScheduler, stopScheduler };