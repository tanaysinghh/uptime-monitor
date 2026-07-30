const ms = require("../utils/parseDuration");
const { Session } = require("../models");
const { generateAccessToken, generateRefreshToken, hashToken } = require("../utils/tokens");
const { Op } = require("sequelize");

const REFRESH_LIFETIME_MS = ms(process.env.JWT_REFRESH_EXPIRES_IN || "7d");

const issueSession = async (user, req) => {
  const session = await Session.create({
    userId: user.id,
    refreshTokenHash: "pending",
    userAgent: req && req.headers ? String(req.headers["user-agent"] || "").slice(0, 500) : null,
    ipAddress: req ? req.ip : null,
    lastUsedAt: new Date(),
    expiresAt: new Date(Date.now() + REFRESH_LIFETIME_MS),
  });

  const refreshToken = generateRefreshToken(user.id, session.id);
  session.refreshTokenHash = hashToken(refreshToken);
  await session.save();

  const accessToken = generateAccessToken(user.id, session.id);
  return { accessToken, refreshToken, session };
};

const rotateSession = async (session, user, req) => {
  const refreshToken = generateRefreshToken(user.id, session.id);
  session.refreshTokenHash = hashToken(refreshToken);
  session.lastUsedAt = new Date();
  if (req) {
    session.ipAddress = req.ip;
    session.userAgent = String(req.headers["user-agent"] || "").slice(0, 500);
  }
  await session.save();
  const accessToken = generateAccessToken(user.id, session.id);
  return { accessToken, refreshToken };
};

const revokeSession = async (session) => {
  session.revokedAt = new Date();
  session.refreshTokenHash = "revoked-" + session.id;
  await session.save();
};

const revokeAllForUser = async (userId, { exceptSessionId = null } = {}) => {
  const where = { userId, revokedAt: null };
  if (exceptSessionId) where.id = { [Op.ne]: exceptSessionId };
  const count = await Session.update(
    { revokedAt: new Date() },
    { where }
  );
  return Array.isArray(count) ? count[0] : count;
};

const findActiveSession = async (sessionId, refreshToken) => {
  const session = await Session.findByPk(sessionId);
  if (!session) return null;
  if (session.revokedAt) return null;
  if (new Date(session.expiresAt) < new Date()) return null;
  if (session.refreshTokenHash !== hashToken(refreshToken)) return null;
  return session;
};

module.exports = {
  issueSession,
  rotateSession,
  revokeSession,
  revokeAllForUser,
  findActiveSession,
};
