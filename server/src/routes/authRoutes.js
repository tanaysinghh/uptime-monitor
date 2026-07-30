const express = require("express");
const router = express.Router();
const { register, login, refreshToken, getMe } = require("../controllers/authController");
const { authenticate } = require("../middlewares/auth");
const { authLimiter, registerLimiter } = require("../middlewares/rateLimiters");

router.post("/register", registerLimiter, register);
router.post("/login", authLimiter, login);
router.post("/refresh-token", authLimiter, refreshToken);
router.get("/me", authenticate, getMe);

module.exports = router;
