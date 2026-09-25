const { buildDialectOptions } = require("../src/config/database");

describe("database TLS options", () => {
  test("DB_SSL unset: no TLS (local Postgres)", () => {
    expect(buildDialectOptions({})).toEqual({});
  });

  test("DB_SSL=true: TLS required and certificate verified", () => {
    expect(buildDialectOptions({ DB_SSL: "true" })).toEqual({ ssl: { require: true, rejectUnauthorized: true } });
  });

  test("DB_SSL_CA adds a trusted root and keeps verification on", () => {
    const pem = "-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----";
    const opts = buildDialectOptions({ DB_SSL: "true", DB_SSL_CA: pem });
    expect(opts.ssl).toEqual({ require: true, rejectUnauthorized: true, ca: pem });
  });

  test("DB_SSL_CA with literal \\n sequences (single-line env var) is unescaped", () => {
    const opts = buildDialectOptions({ DB_SSL: "true", DB_SSL_CA: "-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----" });
    expect(opts.ssl.ca).toBe("-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----");
  });

  test("DB_SSL_CA is ignored unless DB_SSL=true", () => {
    expect(buildDialectOptions({ DB_SSL_CA: "x" })).toEqual({});
  });
});
