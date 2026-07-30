const { User, Organization, Session, MfaChallenge } = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { handleError } = require("../utils/errorResponse");
const { evaluatePassword } = require("../utils/passwordPolicy");
const securityEvents = require("../utils/securityEvents");
const sessionService = require("../services/sessionService");
const logger = require("../utils/logger");

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  organizationId: user.organizationId,
  organization: user.Organization,
  mfaEnabled: !!user.mfaEnabled,
});

const register = async (req, res) => {
  try {
    const { email, password, name, orgName } = req.body;

    const pw = evaluatePassword(password, [email, name, orgName]);
    if (!pw.ok) {
      return res.status(400).json({ error: pw.reason, passwordScore: pw.score });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const existingOrg = await Organization.findOne({ where: { slug } });
    if (existingOrg) {
      return res.status(400).json({ error: "Organization name already taken" });
    }

    const organization = await Organization.create({ name: orgName, slug });

    const user = await User.create({
      email,
      password,
      name,
      organizationId: organization.id,
      isVerified: true,
    });

    const { accessToken, refreshToken } = await sessionService.issueSession(user, req);

    res.status(201).json({
      user: publicUser({ ...user.toJSON ? user.toJSON() : user, Organization: organization }),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const GENERIC_LOGIN_FAILURE = { error: "Invalid credentials" };

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      where: { email },
      include: [Organization],
    });

    if (!user) {
      return res.status(401).json(GENERIC_LOGIN_FAILURE);
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      logger.warn("login blocked by lockout", {
        userId: user.id,
        ip: req.ip,
        lockedUntil: user.lockedUntil,
      });
      return res.status(401).json(GENERIC_LOGIN_FAILURE);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      const justLocked = user.failedLoginAttempts >= LOCKOUT_THRESHOLD;
      if (justLocked) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      }
      await user.save();
      await securityEvents.record({
        userId: user.id,
        organizationId: user.organizationId,
        eventType: "login_failure",
        req,
        metadata: { attempts: user.failedLoginAttempts },
      });
      if (justLocked) {
        await securityEvents.record({
          userId: user.id,
          organizationId: user.organizationId,
          eventType: "account_locked",
          req,
          metadata: { lockedUntil: user.lockedUntil },
        });
      }
      return res.status(401).json(GENERIC_LOGIN_FAILURE);
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await user.save();
    }

    if (user.mfaEnabled) {
      const challenge = await MfaChallenge.create({
        userId: user.id,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        ipAddress: req.ip,
      });
      const mfaChallengeToken = jwt.sign(
        { userId: user.id, cid: challenge.id, typ: "mfa_challenge" },
        process.env.JWT_SECRET,
        { expiresIn: "5m" }
      );
      return res.json({ requiresMfa: true, mfaChallengeToken });
    }

    await securityEvents.record({
      userId: user.id,
      organizationId: user.organizationId,
      eventType: "login_success",
      req,
    });

    const { accessToken, refreshToken } = await sessionService.issueSession(user, req);

    res.json({
      user: publicUser(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    handleError(res, error);
  }
};

const mfaChallenge = async (req, res) => {
  try {
    const { mfaChallengeToken, code } = req.body;

    let decoded;
    try {
      decoded = jwt.verify(mfaChallengeToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid or expired MFA challenge" });
    }
    if (decoded.typ !== "mfa_challenge" || !decoded.cid) {
      return res.status(401).json({ error: "Invalid MFA challenge" });
    }

    const challenge = await MfaChallenge.findByPk(decoded.cid);
    if (!challenge || challenge.usedAt || new Date(challenge.expiresAt) < new Date()) {
      return res.status(401).json({ error: "Invalid or expired MFA challenge" });
    }

    const user = await User.findByPk(decoded.userId, { include: [Organization] });
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return res.status(401).json({ error: "Invalid MFA challenge" });
    }

    const { verifyTotp } = require("./mfaController");
    const { decrypt } = require("../utils/mfaCrypto");
    const backupCodes = require("../utils/backupCodes");

    const cleaned = String(code || "").replace(/\s+/g, "");
    let ok = false;
    let usedBackupCode = false;

    const isTotpFormat = /^\d{6,10}$/.test(cleaned);
    if (isTotpFormat && verifyTotp(decrypt(user.mfaSecret), cleaned)) {
      ok = true;
    } else if (!isTotpFormat) {
      const { matched, remaining } = backupCodes.consumeMatching(cleaned, user.mfaBackupCodes || []);
      if (matched) {
        ok = true;
        usedBackupCode = true;
        user.mfaBackupCodes = remaining;
        await user.save();
      }
    }

    if (!ok) {
      await securityEvents.record({
        userId: user.id,
        organizationId: user.organizationId,
        eventType: "mfa_challenge_failure",
        req,
      });
      return res.status(401).json({ error: "Invalid code" });
    }

    challenge.usedAt = new Date();
    await challenge.save();

    await securityEvents.record({
      userId: user.id,
      organizationId: user.organizationId,
      eventType: usedBackupCode ? "backup_code_used" : "mfa_challenge_success",
      req,
      metadata: usedBackupCode ? { remaining: user.mfaBackupCodes.length } : {},
    });

    const { accessToken, refreshToken } = await sessionService.issueSession(user, req);
    res.json({ user: publicUser(user), accessToken, refreshToken });
  } catch (error) {
    handleError(res, error);
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return res.status(401).json({ error: "Refresh token required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    if (!decoded.sid) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const session = await sessionService.findActiveSession(decoded.sid, token);
    if (!session) {
      return res.status(401).json({ error: "Session revoked or expired" });
    }

    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const { accessToken, refreshToken: newRefreshToken } = await sessionService.rotateSession(
      session,
      user,
      req
    );
    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    handleError(res, error);
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [Organization],
      attributes: { exclude: ["password", "mfaSecret", "mfaBackupCodes"] },
    });
    res.json({ user });
  } catch (error) {
    handleError(res, error);
  }
};

const getSessions = async (req, res) => {
  try {
    const sessions = await Session.findAll({
      where: { userId: req.user.id, revokedAt: null },
      order: [["lastUsedAt", "DESC"]],
      attributes: ["id", "userAgent", "ipAddress", "createdAt", "lastUsedAt", "expiresAt"],
    });
    const currentSid = req.currentSessionId || null;
    res.json({
      sessions: sessions.map((s) => ({ ...s.toJSON(), current: s.id === currentSid })),
    });
  } catch (error) {
    handleError(res, error);
  }
};

const revokeSession = async (req, res) => {
  try {
    const session = await Session.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!session || session.revokedAt) {
      return res.status(404).json({ error: "Session not found" });
    }
    await sessionService.revokeSession(session);
    await securityEvents.record({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      eventType: "session_revoked",
      req,
      metadata: { sessionId: session.id },
    });
    res.json({ message: "Session revoked" });
  } catch (error) {
    handleError(res, error);
  }
};

const logoutAllDevices = async (req, res) => {
  try {
    const revoked = await sessionService.revokeAllForUser(req.user.id);
    await securityEvents.record({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      eventType: "sessions_revoked_all",
      req,
      metadata: { revoked },
    });
    res.json({ message: "All sessions revoked", revoked });
  } catch (error) {
    handleError(res, error);
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const ok = await user.comparePassword(currentPassword);
    if (!ok) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const pw = evaluatePassword(newPassword, [user.email, user.name]);
    if (!pw.ok) {
      return res.status(400).json({ error: pw.reason, passwordScore: pw.score });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();
    await user.save();

    const currentSid = req.currentSessionId || null;
    await sessionService.revokeAllForUser(user.id, { exceptSessionId: currentSid });

    await securityEvents.record({
      userId: user.id,
      organizationId: user.organizationId,
      eventType: "password_changed",
      req,
    });

    res.json({ message: "Password changed. Other active sessions were signed out." });
  } catch (error) {
    handleError(res, error);
  }
};

module.exports = {
  register,
  login,
  mfaChallenge,
  refreshToken,
  getMe,
  getSessions,
  revokeSession,
  logoutAllDevices,
  changePassword,
};
