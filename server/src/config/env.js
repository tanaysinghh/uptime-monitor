const REQUIRED_VARS = [
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_EXPIRES_IN",
  "JWT_REFRESH_EXPIRES_IN",
  "CLIENT_URL",
];

const MIN_SECRET_LENGTH = 32;

const validateEnv = () => {
  const missing = REQUIRED_VARS.filter((k) => !process.env[k] || String(process.env[k]).trim() === "");

  if (missing.length > 0) {
    console.error(
      "FATAL: missing required environment variables: " + missing.join(", ") +
      "\nSee .env.example for the full list."
    );
    process.exit(1);
  }

  const nodeEnv = process.env.NODE_ENV || "development";
  const isProd = nodeEnv === "production";

  if (isProd) {
    for (const secret of ["JWT_SECRET", "JWT_REFRESH_SECRET"]) {
      if (process.env[secret].length < MIN_SECRET_LENGTH) {
        console.error(
          `FATAL: ${secret} must be at least ${MIN_SECRET_LENGTH} characters in production.`
        );
        process.exit(1);
      }
      if (/change[_-]?this|your[_-]?super[_-]?secret|example|placeholder/i.test(process.env[secret])) {
        console.error(`FATAL: ${secret} looks like a placeholder value. Set a real secret.`);
        process.exit(1);
      }
    }

    if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
      console.error("FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be different.");
      process.exit(1);
    }
  }

  return {
    nodeEnv,
    isProd,
    port: parseInt(process.env.PORT, 10) || 5000,
    clientUrl: process.env.CLIENT_URL,
    allowPrivateUrls: process.env.ALLOW_PRIVATE_URLS === "true",
  };
};

module.exports = { validateEnv };
