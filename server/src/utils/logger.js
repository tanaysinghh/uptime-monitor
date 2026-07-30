const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

const format = (level, msg, meta) => {
  const line = {
    level,
    time: new Date().toISOString(),
    msg,
    ...(meta || {}),
  };
  return JSON.stringify(line);
};

const log = (level) => (msg, meta) => {
  if (LEVELS[level] > currentLevel) return;
  const line = format(level, msg, meta);
  if (level === "error") console.error(line);
  else console.log(line);
};

module.exports = {
  error: log("error"),
  warn: log("warn"),
  info: log("info"),
  debug: log("debug"),
};
