const { ApiKey, User, Organization } = require("../models");

const authenticateApiKey = async (req, res, next) => {
  try {
    const authHeader = req.headers["x-api-key"];
    if (!authHeader) {
      return next();
    }

    const keyHash = ApiKey.hashKey(authHeader);

    const apiKey = await ApiKey.findOne({
      where: { keyHash, isActive: true },
    });

    if (!apiKey) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    if (apiKey.expiresAt && new Date() > new Date(apiKey.expiresAt)) {
      return res.status(401).json({ error: "API key expired" });
    }

    apiKey.lastUsedAt = new Date();
    await apiKey.save();

    const user = await User.findByPk(apiKey.userId, {
      include: [Organization],
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = user;
    req.apiKey = apiKey;
    next();
  } catch (error) {
    return res.status(401).json({ error: "API key authentication failed" });
  }
};

module.exports = { authenticateApiKey };