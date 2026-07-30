const crypto = require("crypto");

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_COUNT = 10;
const HALF_LEN = 4;

const randomBlock = () => {
  let out = "";
  const bytes = crypto.randomBytes(HALF_LEN);
  for (let i = 0; i < HALF_LEN; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
};

const generate = () => {
  const codes = [];
  for (let i = 0; i < CODE_COUNT; i++) {
    codes.push(randomBlock() + "-" + randomBlock());
  }
  return codes;
};

const hash = (code) =>
  crypto.createHash("sha256").update(String(code).replace(/-/g, "").toUpperCase()).digest("hex");

const consumeMatching = (candidate, hashedList) => {
  const target = hash(candidate);
  const idx = hashedList.findIndex((h) => timingSafeEquals(h, target));
  if (idx === -1) return { matched: false, remaining: hashedList };
  const remaining = hashedList.slice(0, idx).concat(hashedList.slice(idx + 1));
  return { matched: true, remaining };
};

const timingSafeEquals = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
};

module.exports = { generate, hash, consumeMatching, CODE_COUNT };
