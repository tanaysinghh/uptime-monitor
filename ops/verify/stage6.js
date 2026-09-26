// End-to-end verification of a deployed backend with a throwaway account.
//
//   node ops/verify/stage6.js <base url, e.g. https://uptime-monitor-server-java.onrender.com> [--stomp]
//
// Registration, login, MFA (setup, challenge, backup codes incl. reuse and regeneration),
// refresh-token rotation, dashboard, monitors (create/update/delete, SSRF guard), alert
// channels (create/update/delete, SSRF guard on webhooks), public status page and
// subscribers, audit log, and with --stomp the real-time endpoint's authorization.
// Prints the throwaway account's email and org slug so it can be deleted afterwards.
const path = require("path");
const REPO = path.resolve(__dirname, "..", "..");
const ax = require(path.join(REPO, "client/node_modules/axios"));
const axios = ax.default || ax;
const speakeasy = require(path.join(REPO, "server/node_modules/speakeasy"));

const BASE = process.argv[2].replace(/\/$/, "");
const http = axios.create({ baseURL: `${BASE}/api`, validateStatus: () => true, timeout: 120000 });
const auth = (t) => ({ headers: { Authorization: `Bearer ${t}` } });
const PW = "Tr0ub4dor&3xample!-" + Date.now().toString(36);
let fails = 0;
let passes = 0;
const check = (ok, label, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail !== undefined ? "  — " + (typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 200)) : ""}`);
  ok ? passes++ : fails++;
};
const totp = (secret) => speakeasy.totp({ secret, encoding: "base32" });

const stompCheck = async (token, orgId, otherOrgId) => {
  const { Client } = await import("file:///" + path.join(REPO, "client/node_modules/@stomp/stompjs/esm6/index.js").replace(/\\/g, "/"));
  const wsUrl = BASE.replace(/^http/, "ws") + "/ws";
  const attempt = (headers, destination) =>
    new Promise((resolve) => {
      const result = { connected: false, error: null };
      const client = new Client({ brokerURL: wsUrl, connectHeaders: headers, reconnectDelay: 0, connectionTimeout: 20000 });
      const done = () => { client.deactivate(); resolve(result); };
      client.onConnect = () => {
        result.connected = true;
        client.subscribe(destination, () => {});
        setTimeout(done, 3000); // a refused SUBSCRIBE arrives as an ERROR frame within this window
      };
      client.onStompError = (f) => { result.error = (f.headers.message || "").replace(/\\c/g, ":"); done(); };
      client.onWebSocketError = () => { result.error = result.error || "websocket error"; };
      client.onWebSocketClose = () => { if (!result.error && !result.connected) { result.error = "closed"; resolve(result); } };
      client.activate();
    });
  const own = await attempt({ Authorization: `Bearer ${token}` }, `/topic/org/${orgId}`);
  check(own.connected && !own.error, "STOMP: member subscribes to own organization", own);
  const other = await attempt({ Authorization: `Bearer ${token}` }, `/topic/org/${otherOrgId}`);
  check(other.error === "Forbidden: not a member of this organization", "STOMP: another organization's topic is refused", other);
  const anon = await attempt({}, `/topic/org/${orgId}`);
  check(anon.error === "Unauthorized: organization updates need a signed-in user", "STOMP: anonymous cannot follow an organization", anon);
  const bad = await attempt({ Authorization: "Bearer not-a-token" }, `/topic/org/${orgId}`);
  check(bad.error === "Unauthorized: Invalid token", "STOMP: invalid token refused at CONNECT", bad);
};

(async () => {
  const h = await http.get("/health");
  check(h.status === 200 && h.data.status === "ok" && h.data.db === "ok", "GET /api/health", h.data);

  const s = Date.now().toString(36);
  const email = `stage6-${s}@example.com`;
  const reg = await http.post("/auth/register", { email, password: PW, name: "Stage Six", orgName: `Stage Six ${s}` });
  check(reg.status === 201 && reg.data.accessToken && reg.data.user.organization?.slug, "register → 201 with tokens and organization", { status: reg.status });
  const slug = reg.data.user.organization.slug;
  const orgId = reg.data.user.organizationId;
  console.log(`throwaway account: ${email}  org: ${slug}`);

  const weak = await http.post("/auth/register", { email: `weak-${s}@example.com`, password: "password1", name: "W", orgName: `Weak ${s}` });
  check(weak.status === 400, "register with a weak password → 400", weak.data);
  const dup = await http.post("/auth/register", { email, password: PW, name: "Again", orgName: `Other ${s}` });
  check(dup.status === 400, "register with an existing email → 400", dup.data);

  const login = await http.post("/auth/login", { email, password: PW });
  check(login.status === 200 && login.data.accessToken && !login.data.requiresMfa, "login → 200 with tokens", { status: login.status });
  const bad = await http.post("/auth/login", { email, password: "wrong-password-1" });
  check(bad.status === 401 && bad.data.error === "Invalid credentials", "wrong password → 401 Invalid credentials", bad.data);
  let token = login.data.accessToken;

  const refreshed = await http.post("/auth/refresh-token", { refreshToken: login.data.refreshToken });
  check(refreshed.status === 200 && refreshed.data.refreshToken !== login.data.refreshToken, "refresh-token rotates the refresh token", { status: refreshed.status });
  const reused = await http.post("/auth/refresh-token", { refreshToken: login.data.refreshToken });
  check(reused.status === 401, "a rotated-out refresh token is refused", reused.data);

  const me = await http.get("/auth/me", auth(token));
  check(me.status === 200 && me.data.user.organization?.slug === slug && me.data.user.Organization?.slug === slug, "/auth/me has organization and Organization", { status: me.status });

  // MFA
  const setup = await http.post("/auth/mfa/setup", null, auth(token));
  check(setup.status === 200 && /^[A-Z2-7]+$/.test(setup.data.secret) && setup.data.qrDataUrl?.startsWith("data:image/png"), "MFA setup → secret + QR", { status: setup.status });
  const secret = setup.data.secret;
  const wrongVerify = await http.post("/auth/mfa/verify", { code: "000000" }, auth(token));
  check(wrongVerify.status === 401, "MFA verify with a wrong code → 401", wrongVerify.data);
  const verify = await http.post("/auth/mfa/verify", { code: totp(secret) }, auth(token));
  check(verify.status === 200 && verify.data.enabled && verify.data.backupCodes?.length === 10, "MFA verify → enabled, 10 backup codes", { status: verify.status });
  const codes = verify.data.backupCodes;

  const step1 = await http.post("/auth/login", { email, password: PW });
  check(step1.status === 200 && step1.data.requiresMfa && step1.data.mfaChallengeToken && !step1.data.accessToken, "login with MFA → challenge token only", { requiresMfa: step1.data.requiresMfa });
  const asBearer = await http.get("/auth/me", auth(step1.data.mfaChallengeToken));
  check(asBearer.status === 401, "challenge token is not accepted as a Bearer token", asBearer.data);
  const wrong = await http.post("/auth/mfa/challenge", { mfaChallengeToken: step1.data.mfaChallengeToken, code: "000000" });
  check(wrong.status === 401, "challenge with a wrong code → 401", wrong.data);
  const step2 = await http.post("/auth/mfa/challenge", { mfaChallengeToken: step1.data.mfaChallengeToken, code: totp(secret) });
  check(step2.status === 200 && step2.data.accessToken, "challenge with a valid TOTP → tokens", { status: step2.status });
  token = step2.data.accessToken;

  const b1 = await http.post("/auth/login", { email, password: PW });
  const viaBackup = await http.post("/auth/mfa/challenge", { mfaChallengeToken: b1.data.mfaChallengeToken, code: codes[0] });
  check(viaBackup.status === 200, "challenge with a backup code → tokens", { status: viaBackup.status });
  const b2 = await http.post("/auth/login", { email, password: PW });
  const reuse = await http.post("/auth/mfa/challenge", { mfaChallengeToken: b2.data.mfaChallengeToken, code: codes[0] });
  check(reuse.status === 401, "a used backup code is refused", reuse.data);
  const regen = await http.post("/auth/mfa/backup-codes/regenerate", { code: totp(secret) }, auth(token));
  check(regen.status === 200 && regen.data.backupCodes?.length === 10 && !regen.data.backupCodes.includes(codes[1]), "backup codes regenerate (old set replaced)", { status: regen.status });
  const b3 = await http.post("/auth/login", { email, password: PW });
  const oldCode = await http.post("/auth/mfa/challenge", { mfaChallengeToken: b3.data.mfaChallengeToken, code: codes[1] });
  check(oldCode.status === 401, "a code from the replaced set is refused", oldCode.data);

  // Dashboard and monitors
  const dash = await http.get("/stats/dashboard", auth(token));
  check(dash.status === 200 && dash.data.totalMonitors === 0 && Array.isArray(dash.data.activeIncidents), "dashboard stats → 200", { totalMonitors: dash.data.totalMonitors });
  const mon = await http.post("/monitors", { name: "example.com", url: "https://example.com", intervalSeconds: 300 }, auth(token));
  const monitor = mon.data.monitor || mon.data;
  check(mon.status === 201 && monitor.id, "create monitor → 201", { status: mon.status });
  const upd = await http.put(`/monitors/${monitor.id}`, { name: "example.com (renamed)" }, auth(token));
  check(upd.status === 200 && (upd.data.monitor || upd.data).name === "example.com (renamed)", "update monitor → 200", { status: upd.status });
  for (const url of ["http://169.254.169.254/", "http://127.0.0.1:5432/", "http://10.0.0.5/", "http://localhost/"]) {
    const r = await http.post("/monitors", { name: "ssrf", url }, auth(token));
    check(r.status === 400, `SSRF guard refuses monitor ${url}`, r.data);
  }
  const detail = await http.get(`/monitors/${monitor.id}`, auth(token));
  check(detail.status === 200, "monitor detail → 200", { status: detail.status });
  const checks = await http.get(`/monitors/${monitor.id}/checks?period=24h`, auth(token));
  check(checks.status === 200 && Array.isArray(checks.data.checks), "monitor checks → 200", { status: checks.status });

  // Alert channels
  const wh = await http.post("/alerts/channels", { name: "hook", type: "webhook", config: { url: "https://example.com/uptime-hook" } }, auth(token));
  const channel = wh.data.channel || wh.data;
  check(wh.status === 201 && channel.id, "create webhook channel → 201", { status: wh.status });
  const chUpd = await http.put(`/alerts/channels/${channel.id}`, { name: "hook renamed", cooldownMinutes: 10 }, auth(token));
  check(chUpd.status === 200, "update channel → 200", { status: chUpd.status });
  const privHook = await http.post("/alerts/channels", { name: "evil", type: "webhook", config: { url: "http://169.254.169.254/latest" } }, auth(token));
  const privTest = privHook.status === 201
    ? await http.post(`/alerts/channels/${(privHook.data.channel || privHook.data).id}/test`, null, auth(token))
    : privHook;
  check(privHook.status === 400 || privTest.status >= 400, "SSRF guard stops a webhook to a metadata address", { create: privHook.status, test: privTest.status, error: privTest.data?.error });
  const channels = await http.get("/alerts/channels", auth(token));
  check(channels.status === 200 && channels.data.channels.some((c) => c.id === channel.id), "list channels → includes the new one", { count: channels.data.channels?.length });
  const logs = await http.get("/alerts/logs", auth(token));
  check(logs.status === 200, "alert logs → 200", { status: logs.status });

  // Public status page and subscribers
  const pub = await http.get(`/public/status/${slug}`);
  check(pub.status === 200 && pub.data.monitors.length === 1 && pub.data.organization.slug === slug, "public status page → 200 with the monitor", { overallStatus: pub.data.overallStatus });
  const sub = await http.post(`/public/status/${slug}/subscribe`, { email: `sub-${s}@example.com` });
  check(sub.status === 201, "status page subscribe → 201", { status: sub.status });
  const badge = await http.get(`/public/status/${slug}/badge.svg`);
  check(badge.status === 200 && String(badge.data).includes("<svg"), "status badge → SVG", { status: badge.status });

  const audit = await http.get("/team/audit-log", auth(token));
  check(audit.status === 200 && Array.isArray(audit.data.logs), "team audit log → 200", { status: audit.status });

  if (process.argv.includes("--stomp")) {
    const other = await http.post("/auth/register", { email: `stage6-other-${s}@example.com`, password: PW, name: "Other", orgName: `Stage Six Other ${s}` });
    await stompCheck(token, orgId, other.data.user.organizationId);
    console.log(`second throwaway account: stage6-other-${s}@example.com  org: ${other.data.user.organization.slug}`);
  }

  const del = await http.delete(`/monitors/${monitor.id}`, auth(token));
  check(del.status === 200, "delete monitor → 200", { status: del.status });
  const delCh = await http.delete(`/alerts/channels/${channel.id}`, auth(token));
  check(delCh.status === 200, "delete channel → 200", { status: delCh.status });

  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error("ERROR", e.stack || e.message);
  process.exit(1);
});
