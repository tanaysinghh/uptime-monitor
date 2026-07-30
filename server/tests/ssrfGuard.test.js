const { validateMonitorUrl, isPrivateAddress } = require("../src/utils/ssrfGuard");

describe("isPrivateAddress", () => {
  test.each([
    ["127.0.0.1", true],
    ["10.0.0.1", true],
    ["172.16.5.6", true],
    ["192.168.1.1", true],
    ["169.254.169.254", true],
    ["0.0.0.0", true],
    ["100.64.0.1", true],
    ["8.8.8.8", false],
    ["1.1.1.1", false],
    ["::1", true],
    ["fe80::1", true],
    ["fd00::1", true],
    ["2606:4700:4700::1111", false],
  ])("%s -> %s", (ip, expected) => {
    expect(isPrivateAddress(ip)).toBe(expected);
  });
});

describe("validateMonitorUrl", () => {
  const orig = process.env.ALLOW_PRIVATE_URLS;
  afterEach(() => {
    if (orig === undefined) delete process.env.ALLOW_PRIVATE_URLS;
    else process.env.ALLOW_PRIVATE_URLS = orig;
  });

  test("rejects non-http protocol", async () => {
    delete process.env.ALLOW_PRIVATE_URLS;
    const r = await validateMonitorUrl("file:///etc/passwd");
    expect(r.ok).toBe(false);
  });

  test("rejects private IP literal", async () => {
    delete process.env.ALLOW_PRIVATE_URLS;
    const r = await validateMonitorUrl("http://192.168.0.1/");
    expect(r.ok).toBe(false);
  });

  test("rejects localhost hostname", async () => {
    delete process.env.ALLOW_PRIVATE_URLS;
    const r = await validateMonitorUrl("http://localhost/api");
    expect(r.ok).toBe(false);
  });

  test("rejects malformed url", async () => {
    delete process.env.ALLOW_PRIVATE_URLS;
    const r = await validateMonitorUrl("not a url");
    expect(r.ok).toBe(false);
  });

  test("ALLOW_PRIVATE_URLS=true bypasses all checks", async () => {
    process.env.ALLOW_PRIVATE_URLS = "true";
    const r = await validateMonitorUrl("http://127.0.0.1:5000/");
    expect(r.ok).toBe(true);
  });
});
