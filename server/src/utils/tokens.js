const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const generateAccessToken = (userId, sessionId) => {
  const payload = { userId };
  if (sessionId) payload.sid = sessionId;
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const generateRefreshToken = (userId, sessionId) => {
  const jti = crypto.randomUUID();
  return jwt.sign({ userId, sid: sessionId, jti }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });
};

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

module.exports = { generateAccessToken, generateRefreshToken, hashToken };
