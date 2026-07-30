const { body, param } = require("express-validator");

const registerValidator = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  body("password").isLength({ min: 8, max: 200 }).withMessage("Password must be 8-200 chars"),
  body("name").isString().trim().isLength({ min: 1, max: 100 }).withMessage("Name required"),
  body("orgName").isString().trim().isLength({ min: 1, max: 100 }).withMessage("Organization name required"),
];

const loginValidator = [
  body("email").isEmail().normalizeEmail(),
  body("password").isString().notEmpty(),
];

const refreshValidator = [body("refreshToken").isString().notEmpty()];

const monitorValidator = [
  body("name").isString().trim().isLength({ min: 1, max: 200 }),
  body("url").isString().isLength({ max: 2048 }),
  body("method").optional().isIn(["GET", "POST", "HEAD", "PUT", "PATCH"]),
  body("intervalSeconds").optional().isInt({ min: 30, max: 86400 }),
  body("timeoutMs").optional().isInt({ min: 1000, max: 60000 }),
  body("expectedStatus").optional().isInt({ min: 100, max: 599 }),
  body("headers").optional().isObject(),
  body("tags").optional().isArray(),
];

const monitorUpdateValidator = [
  body("name").optional().isString().trim().isLength({ min: 1, max: 200 }),
  body("url").optional().isString().isLength({ max: 2048 }),
  body("method").optional().isIn(["GET", "POST", "HEAD", "PUT", "PATCH"]),
  body("intervalSeconds").optional().isInt({ min: 30, max: 86400 }),
  body("timeoutMs").optional().isInt({ min: 1000, max: 60000 }),
  body("expectedStatus").optional().isInt({ min: 100, max: 599 }),
  body("status").optional().isIn(["up", "down", "paused", "pending"]),
];

const uuidParam = (name = "id") => [param(name).isUUID().withMessage(`${name} must be a UUID`)];

const alertChannelValidator = [
  body("name").isString().trim().isLength({ min: 1, max: 200 }),
  body("type").isIn(["email", "webhook", "slack", "discord"]),
  body("config").isObject(),
  body("cooldownMinutes").optional().isInt({ min: 0, max: 1440 }),
];

const inviteValidator = [
  body("email").isEmail().normalizeEmail(),
  body("name").isString().trim().isLength({ min: 1, max: 100 }),
  body("password").isLength({ min: 8, max: 200 }),
  body("role").optional().isIn(["admin", "editor", "viewer"]),
];

const updateRoleValidator = [body("role").isIn(["admin", "editor", "viewer"])];

const apiKeyValidator = [
  body("name").isString().trim().isLength({ min: 1, max: 200 }),
  body("permissions").optional().isArray(),
  body("expiresAt").optional({ nullable: true }).isISO8601(),
];

const subscribeValidator = [body("email").isEmail().normalizeEmail()];

const heartbeatCreateValidator = [
  body("name").isString().trim().isLength({ min: 1, max: 200 }),
  body("heartbeatInterval").optional().isInt({ min: 30, max: 86400 }),
];

const maintenanceValidator = [
  body("reason").optional().isString().isLength({ max: 500 }),
  body("startAt").optional().isISO8601(),
  body("endAt").optional().isISO8601(),
];

module.exports = {
  registerValidator,
  loginValidator,
  refreshValidator,
  monitorValidator,
  monitorUpdateValidator,
  uuidParam,
  alertChannelValidator,
  inviteValidator,
  updateRoleValidator,
  apiKeyValidator,
  subscribeValidator,
  heartbeatCreateValidator,
  maintenanceValidator,
};
