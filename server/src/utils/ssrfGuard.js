const { URL } = require("url");
const dns = require("dns").promises;
const net = require("net");

const PRIVATE_V4_RANGES = [
  [10, 0, 0, 0, 8],
  [127, 0, 0, 0, 8],
  [169, 254, 0, 0, 16],
  [172, 16, 0, 0, 12],
  [192, 168, 0, 0, 16],
  [0, 0, 0, 0, 8],
  [100, 64, 0, 0, 10],
];

const ipToLong = (ip) => {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
};

const inRange = (ip, [a, b, c, d, bits]) => {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  const network = (((a << 24) | (b << 16) | (c << 8) | d) >>> 0) & mask;
  return (ipToLong(ip) & mask) === network;
};

const isPrivateV4 = (ip) => PRIVATE_V4_RANGES.some((r) => inRange(ip, r));

const isPrivateV6 = (ip) => {
  const lower = ip.toLowerCase();
  return (
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80") ||
    lower.startsWith("::ffff:")
  );
};

const isPrivateAddress = (ip) => {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateV4(ip);
  if (family === 6) return isPrivateV6(ip);
  return false;
};

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const validateMonitorUrl = async (rawUrl) => {
  if (process.env.ALLOW_PRIVATE_URLS === "true") return { ok: true };

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { ok: false, reason: `Protocol ${parsed.protocol} not allowed. Use http or https.` };
  }

  const host = parsed.hostname;
  if (!host) return { ok: false, reason: "URL missing hostname" };

  const lowered = host.toLowerCase();
  if (lowered === "localhost" || lowered.endsWith(".localhost") || lowered.endsWith(".internal")) {
    return { ok: false, reason: "Loopback / internal hostnames are not allowed" };
  }

  if (net.isIP(host)) {
    if (isPrivateAddress(host)) {
      return { ok: false, reason: "URL resolves to a private / loopback address" };
    }
    return { ok: true };
  }

  try {
    const records = await dns.lookup(host, { all: true });
    if (!records || records.length === 0) {
      return { ok: false, reason: "DNS lookup returned no records" };
    }
    for (const r of records) {
      if (isPrivateAddress(r.address)) {
        return { ok: false, reason: "URL resolves to a private / loopback address" };
      }
    }
  } catch (err) {
    return { ok: false, reason: "DNS lookup failed: " + err.code };
  }

  return { ok: true };
};

module.exports = { validateMonitorUrl, isPrivateAddress };
