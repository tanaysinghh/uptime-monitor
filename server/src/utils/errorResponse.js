const handleError = (res, err, statusCode = 500) => {
  const isProd = process.env.NODE_ENV === "production";
  console.error("[error]", err && err.stack ? err.stack : err);
  const message = isProd
    ? statusCode >= 500
      ? "Internal server error"
      : err.message || "Request failed"
    : err.message || String(err);
  res.status(statusCode).json({ error: message });
};

module.exports = { handleError };
