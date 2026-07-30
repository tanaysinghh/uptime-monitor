const express = require("express");
const router = express.Router();
const {
  register,
  login,
  refreshToken,
  getMe,
  getSessions,
  revokeSession,
  logoutAllDevices,
  changePassword,
} = require("../controllers/authController");
const { authenticate } = require("../middlewares/auth");
const { authLimiter, loginLimiter, mfaLimiter, registerLimiter } = require("../middlewares/rateLimiters");
const mfa = require("../controllers/mfaController");
const { validate } = require("../middlewares/validate");
const {
  registerValidator,
  loginValidator,
  refreshValidator,
  uuidParam,
} = require("../middlewares/validators");
const { body } = require("express-validator");

router.post("/register", registerLimiter, registerValidator, validate, register);
router.post("/login", loginLimiter, loginValidator, validate, login);
router.post("/refresh-token", authLimiter, refreshValidator, validate, refreshToken);
router.get("/me", authenticate, getMe);

router.get("/sessions", authenticate, getSessions);
router.delete("/sessions/:id", authenticate, uuidParam(), validate, revokeSession);
router.post("/logout-all-devices", authenticate, logoutAllDevices);

router.post(
  "/password",
  authenticate,
  [
    body("currentPassword").isString().notEmpty(),
    body("newPassword").isString().isLength({ min: 8, max: 200 }),
  ],
  validate,
  changePassword
);

router.post("/mfa/setup", authenticate, mfaLimiter, mfa.setup);
router.post(
  "/mfa/verify",
  authenticate,
  mfaLimiter,
  [body("code").isString().isLength({ min: 6, max: 10 })],
  validate,
  mfa.verify
);
router.post(
  "/mfa/disable",
  authenticate,
  mfaLimiter,
  [
    body("password").isString().notEmpty(),
    body("code").isString().isLength({ min: 6, max: 10 }),
  ],
  validate,
  mfa.disable
);
router.post(
  "/mfa/backup-codes/regenerate",
  authenticate,
  mfaLimiter,
  [body("code").isString().isLength({ min: 6, max: 10 })],
  validate,
  mfa.regenerateBackupCodes
);

module.exports = router;
