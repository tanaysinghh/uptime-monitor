const crypto = require("crypto");

const requestId = (req, res, next) => {
  const incoming = req.headers["x-request-id"];
  const id = incoming && /^[a-zA-Z0-9-]{8,128}$/.test(incoming) ? incoming : crypto.randomUUID();
  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
};

module.exports = { requestId };
