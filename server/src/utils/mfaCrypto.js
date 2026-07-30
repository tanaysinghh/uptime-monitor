const crypto = require("crypto");

const ALG = "aes-256-gcm";

const keyBuffer = () => {
  const hex = (process.env.MFA_ENCRYPTION_KEY || "").replace(/[^0-9a-f]/gi, "");
  if (hex.length !== 64) {
    if (process.env.NODE_ENV === "test") {
      return crypto.createHash("sha256").update("test-mfa-key").digest();
    }
    throw new Error("MFA_ENCRYPTION_KEY missing or wrong length");
  }
  return Buffer.from(hex, "hex");
};

const encrypt = (plaintext) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, keyBuffer(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
};

const decrypt = (ciphertext) => {
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALG, keyBuffer(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
};

module.exports = { encrypt, decrypt };
