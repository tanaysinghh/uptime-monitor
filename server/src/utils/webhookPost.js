const axios = require("axios");
const { validateMonitorUrl } = require("./ssrfGuard");

// POST a JSON payload to an alert channel endpoint (webhook / Slack / Discord).
// Channel URLs are user-supplied, so they get the same SSRF guard as monitor URLs,
// and redirects are refused so a public URL can't bounce the request to an internal
// address. ALLOW_PRIVATE_URLS=true disables the guard for local development.
const postToChannel = async (url, payload) => {
  if (!url) {
    throw new Error("Channel has no URL configured");
  }
  const check = await validateMonitorUrl(url);
  if (!check.ok) {
    throw new Error(check.reason);
  }
  return axios.post(url, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 10000,
    maxRedirects: 0,
  });
};

module.exports = { postToChannel };
