const express = require("express");
const router = express.Router();
const { register, login, refreshToken, getMe } = require("../controllers/authController");
const { authenticate } = require("../middlewares/auth");
const { authLimiter, loginLimiter, registerLimiter } = require("../middlewares/rateLimiters");
const { validate } = require("../middlewares/validate");
const {
  registerValidator,
  loginValidator,
  refreshValidator,
} = require("../middlewares/validators");

router.post("/register", registerLimiter, registerValidator, validate, register);
router.post("/login", loginLimiter, loginValidator, validate, login);
router.post("/refresh-token", authLimiter, refreshValidator, validate, refreshToken);
router.get("/me", authenticate, getMe);

module.exports = router;
