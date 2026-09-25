jest.mock("axios", () => ({ post: jest.fn(async () => ({ status: 200 })) }));

const mockChannels = [];
const mockLogs = [];
jest.mock("../src/models", () => ({
  AlertChannel: { findAll: async () => mockChannels },
  AlertLog: {
    create: async (fields) => {
      mockLogs.push(fields);
      return fields;
    },
  },
}));

const axios = require("axios");
const { postToChannel } = require("../src/utils/webhookPost");
const { sendAlert } = require("../src/services/alertService");

describe("alert webhook SSRF guard", () => {
  const orig = process.env.ALLOW_PRIVATE_URLS;
  beforeEach(() => {
    delete process.env.ALLOW_PRIVATE_URLS;
    axios.post.mockClear();
    mockChannels.length = 0;
    mockLogs.length = 0;
  });
  afterAll(() => {
    if (orig === undefined) delete process.env.ALLOW_PRIVATE_URLS;
    else process.env.ALLOW_PRIVATE_URLS = orig;
  });

  test.each([
    "http://127.0.0.1:8080/hook",
    "http://169.254.169.254/latest/meta-data",
    "http://10.0.0.5/webhook",
    "http://localhost/hook",
    "file:///etc/passwd",
  ])("refuses to post to %s", async (url) => {
    await expect(postToChannel(url, {})).rejects.toThrow();
    expect(axios.post).not.toHaveBeenCalled();
  });

  test("refuses a channel with no URL", async () => {
    await expect(postToChannel(undefined, {})).rejects.toThrow("Channel has no URL configured");
  });

  test("posts to a public IP without following redirects", async () => {
    await postToChannel("https://93.184.216.34/hook", { a: 1 });
    expect(axios.post).toHaveBeenCalledWith(
      "https://93.184.216.34/hook",
      { a: 1 },
      expect.objectContaining({ maxRedirects: 0, timeout: 10000 })
    );
  });

  test("ALLOW_PRIVATE_URLS=true allows local webhooks (development)", async () => {
    process.env.ALLOW_PRIVATE_URLS = "true";
    await postToChannel("http://127.0.0.1:9000/hook", {});
    expect(axios.post).toHaveBeenCalled();
  });

  test("sendAlert logs a failed delivery for a private webhook instead of posting", async () => {
    mockChannels.push({
      id: "ch-1", type: "webhook", config: { url: "http://192.168.1.10/hook" },
      cooldownMinutes: 5, lastAlertedAt: null, save: jest.fn(),
    });
    await sendAlert({ id: "m-1", organizationId: "org-1", name: "API", url: "https://x", status: "down" }, null, "down");
    expect(axios.post).not.toHaveBeenCalled();
    expect(mockLogs).toHaveLength(1);
    expect(mockLogs[0]).toMatchObject({ status: "failed", channelId: "ch-1" });
    expect(mockLogs[0].errorMessage).toMatch(/private/i);
  });
});
