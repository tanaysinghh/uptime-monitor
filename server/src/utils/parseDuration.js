const parseDuration = (input) => {
  if (typeof input === "number") return input;
  if (!input) return 0;
  const m = String(input).trim().match(/^(\d+)\s*(ms|s|m|h|d)?$/i);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const unit = (m[2] || "ms").toLowerCase();
  const mult = { ms: 1, s: 1e3, m: 60e3, h: 3600e3, d: 86400e3 }[unit];
  return n * mult;
};

module.exports = parseDuration;
