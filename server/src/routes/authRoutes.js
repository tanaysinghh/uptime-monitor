const express = require("express");
const router = express.Router();
const { register, login, refreshToken, getMe } = require("../controllers/authController");
const { authenticate } = require("../middlewares/auth");

router.post("/register", register);
router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.get("/me", authenticate, getMe);

module.exports = router;
