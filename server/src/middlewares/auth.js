const jwt = require("jsonwebtoken");
const { User, Session } = require("../models");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (decoded.sid) {
      const session = await Session.findByPk(decoded.sid);
      if (!session || session.revokedAt) {
        return res.status(401).json({ error: "Session revoked" });
      }
      req.currentSessionId = decoded.sid;
    }

    if (
      user.passwordChangedAt &&
      decoded.iat &&
      Math.floor(user.passwordChangedAt.getTime() / 1000) > decoded.iat
    ) {
      return res.status(401).json({ error: "Token invalidated by password change" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

module.exports = { authenticate };
