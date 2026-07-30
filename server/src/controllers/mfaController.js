const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const { User } = require("../models");
const { handleError } = require("../utils/errorResponse");
const { encrypt, decrypt } = require("../utils/mfaCrypto");
const backupCodes = require("../utils/backupCodes");
const securityEvents = require("../utils/securityEvents");

const APP_NAME = "UptimeMonitor";

const verifyTotp = (secret, token) =>
  speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: String(token || "").replace(/\s+/g, ""),
    window: 1,
  });

const setup = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.mfaEnabled) {
      return res.status(400).json({ error: "MFA is already enabled. Disable it first to re-enroll." });
    }

    const gen = speakeasy.generateSecret({
      length: 20,
      name: `${APP_NAME} (${user.email})`,
      issuer: APP_NAME,
    });
    user.mfaSecret = encrypt(gen.base32);
    await user.save();

    const qrDataUrl = await QRCode.toDataURL(gen.otpauth_url);

    res.json({ secret: gen.base32, otpauthUrl: gen.otpauth_url, qrDataUrl });
  } catch (err) {
    handleError(res, err);
  }
};

const verify = async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user || !user.mfaSecret) {
      return res.status(400).json({ error: "MFA setup not started" });
    }
    if (user.mfaEnabled) {
      return res.status(400).json({ error: "MFA already enabled" });
    }
    const secret = decrypt(user.mfaSecret);
    if (!verifyTotp(secret, code)) {
      return res.status(401).json({ error: "Invalid code" });
    }

    const codes = backupCodes.generate();
    user.mfaBackupCodes = codes.map(backupCodes.hash);
    user.mfaEnabled = true;
    user.mfaConfirmedAt = new Date();
    await user.save();

    await securityEvents.record({
      userId: user.id,
      organizationId: user.organizationId,
      eventType: "mfa_enabled",
      req,
    });

    res.json({ enabled: true, backupCodes: codes });
  } catch (err) {
    handleError(res, err);
  }
};

const disable = async (req, res) => {
  try {
    const { password, code } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user || !user.mfaEnabled) {
      return res.status(400).json({ error: "MFA is not enabled" });
    }

    const passwordOk = await user.comparePassword(password);
    if (!passwordOk) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const secret = decrypt(user.mfaSecret);
    if (!verifyTotp(secret, code)) {
      return res.status(401).json({ error: "Invalid code" });
    }

    user.mfaEnabled = false;
    user.mfaSecret = null;
    user.mfaBackupCodes = [];
    user.mfaConfirmedAt = null;
    await user.save();

    const sessionService = require("../services/sessionService");
    await sessionService.revokeAllForUser(user.id, { exceptSessionId: req.currentSessionId });

    await securityEvents.record({
      userId: user.id,
      organizationId: user.organizationId,
      eventType: "mfa_disabled",
      req,
    });

    res.json({ enabled: false });
  } catch (err) {
    handleError(res, err);
  }
};

const regenerateBackupCodes = async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user || !user.mfaEnabled) {
      return res.status(400).json({ error: "MFA is not enabled" });
    }
    const secret = decrypt(user.mfaSecret);
    if (!verifyTotp(secret, code)) {
      return res.status(401).json({ error: "Invalid code" });
    }

    const codes = backupCodes.generate();
    user.mfaBackupCodes = codes.map(backupCodes.hash);
    await user.save();

    await securityEvents.record({
      userId: user.id,
      organizationId: user.organizationId,
      eventType: "backup_codes_regenerated",
      req,
    });

    res.json({ backupCodes: codes });
  } catch (err) {
    handleError(res, err);
  }
};

module.exports = { setup, verify, disable, regenerateBackupCodes, verifyTotp };
