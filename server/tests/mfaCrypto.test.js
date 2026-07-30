const { encrypt, decrypt } = require("../src/utils/mfaCrypto");

describe("mfaCrypto", () => {
  test("round trips a secret", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const enc = encrypt(secret);
    expect(enc).not.toContain(secret);
    expect(decrypt(enc)).toBe(secret);
  });

  test("two encryptions of same plaintext differ (fresh IV)", () => {
    const a = encrypt("same");
    const b = encrypt("same");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("same");
    expect(decrypt(b)).toBe("same");
  });

  test("tampered ciphertext throws on decrypt", () => {
    const enc = encrypt("something");
    const buf = Buffer.from(enc, "base64");
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString("base64");
    expect(() => decrypt(tampered)).toThrow();
  });
});
