const { User, Organization } = require("../models");
const { generateAccessToken, generateRefreshToken } = require("../utils/tokens");
const jwt = require("jsonwebtoken");
const { handleError } = require("../utils/errorResponse");
const logger = require("../utils/logger");

const register = async (req, res) => {
  try {
    const { email, password, name, orgName } = req.body;

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

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: organization.id,
      },
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
      if (user.failedLoginAttempts >= LOCKOUT_THRESHOLD) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        logger.warn("account locked", {
          userId: user.id,
          ip: req.ip,
          attempts: user.failedLoginAttempts,
        });
      }
      await user.save();
      return res.status(401).json(GENERIC_LOGIN_FAILURE);
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await user.save();
    }

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        organization: user.Organization,
      },
      accessToken,
      refreshToken,
    });
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

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const accessToken = generateAccessToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [Organization],
      attributes: { exclude: ["password"] },
    });

    res.json({ user });
  } catch (error) {
    handleError(res, error);
  }
};

module.exports = { register, login, refreshToken, getMe };
