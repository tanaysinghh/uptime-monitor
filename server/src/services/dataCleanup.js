const cron = require("node-cron");
const { Check } = require("../models");
const { Op } = require("sequelize");

const RETENTION_DAYS = 90;

let cleanupTask = null;

const startCleanup = () => {
  console.log("Data cleanup scheduler started");

  cleanupTask = cron.schedule("0 3 * * *", async () => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

      const deleted = await Check.destroy({
        where: {
          checkedAt: { [Op.lt]: cutoff },
        },
      });

      if (deleted > 0) {
        console.log(`Cleaned up ${deleted} old check records`);
      }
    } catch (error) {
      console.error("Data cleanup error:", error.message);
    }
  });
};

const stopCleanup = () => {
  if (cleanupTask) {
    cleanupTask.stop();
  }
};

module.exports = { startCleanup, stopCleanup };