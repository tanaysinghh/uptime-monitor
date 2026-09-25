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

  test("DB_SSL_CA_FILE loads the bundled Supabase root CA relative to the server root", () => {
    const opts = buildDialectOptions({ DB_SSL: "true", DB_SSL_CA_FILE: "src/config/certs/supabase-root-2021.crt" });
    expect(opts.ssl.rejectUnauthorized).toBe(true);
    expect(opts.ssl.ca).toMatch(/^-----BEGIN CERTIFICATE-----\r?\nMIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYw/);
    expect(opts.ssl.ca.trim()).toMatch(/-----END CERTIFICATE-----$/);
  });

  test("the bundled CA is Supabase Root 2021 CA (pinned SHA-256 fingerprint)", () => {
    const { X509Certificate } = require("crypto");
    const pem = require("fs").readFileSync(require("path").join(__dirname, "../src/config/certs/supabase-root-2021.crt"));
    const cert = new X509Certificate(pem);
    expect(cert.subject).toMatch(/CN=Supabase Root 2021 CA/);
    expect(cert.fingerprint256).toBe(
      "80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA"
    );
  });
});
