const rateLimit = require("express-rate-limit");

const baseOptions = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
};

const authLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many auth attempts. Try again in 15 minutes." },
});

const registerLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Too many registration attempts. Try again in an hour." },
});

const heartbeatLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.params.token || req.ip,
});

const publicLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  max: 30,
});

const subscribeLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Too many subscription attempts from this IP." },
});

module.exports = {
  authLimiter,
  registerLimiter,
  heartbeatLimiter,
  publicLimiter,
  subscribeLimiter,
};
