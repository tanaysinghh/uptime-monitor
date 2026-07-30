const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: `Requires one of: ${allowedRoles.join(", ")}. You are ${req.user.role}.`,
    });
  }
  next();
};

const requireAdmin = requireRole("admin");
const requireEditor = requireRole("admin", "editor");

module.exports = { requireRole, requireAdmin, requireEditor };
