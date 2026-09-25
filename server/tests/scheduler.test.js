const mockMonitors = [];
const mockChecks = [];
const mockIncidents = [];

jest.mock("../src/models", () => ({
  Monitor: {
    findAll: async () => mockMonitors,
  },
  Check: {
    create: async (fields) => {
      mockChecks.push(fields);
      return fields;
    },
  },
  Incident: {
    create: async (fields) => {
      const incident = { id: "i-" + (mockIncidents.length + 1), ...fields };
      mockIncidents.push(incident);
      return incident;
    },
  },
  Organization: { findByPk: async () => ({ slug: "acme" }) },
  AlertChannel: { findAll: async () => [] },
  AlertLog: { create: async () => ({}) },
}));

jest.mock("../src/services/alertService", () => ({ sendAlert: jest.fn(async () => {}) }));

const { isDue } = require("../src/services/healthCheckService");
const { checkHeartbeatMonitors } = require("../src/services/heartbeatService");

describe("isDue (HTTP check scheduling)", () => {
  const now = Date.parse("2026-01-01T00:00:30.000Z");

  test("a 30s monitor checked just after the previous tick is due on the next tick", () => {
    // previous check was stamped 50ms after its tick, so only 29.95s have "elapsed"
    const m = { intervalSeconds: 30, lastCheckedAt: new Date(now - 29950) };
    expect(isDue(m, now)).toBe(true);
  });

  test("a monitor checked well within its interval is not due", () => {
    expect(isDue({ intervalSeconds: 60, lastCheckedAt: new Date(now - 30000) }, now)).toBe(false);
    expect(isDue({ intervalSeconds: 300, lastCheckedAt: new Date(now - 200000) }, now)).toBe(false);
  });

  test("a never-checked monitor is due", () => {
    expect(isDue({ intervalSeconds: 300, lastCheckedAt: null }, now)).toBe(true);
  });
});

describe("checkHeartbeatMonitors", () => {
  const heartbeat = (fields) => ({
    id: "m-" + Math.random().toString(36).slice(2),
    name: "nightly job",
    organizationId: "org-1",
    monitorType: "heartbeat",
    status: "pending",
    consecutiveFailures: 0,
    heartbeatInterval: 60,
    lastHeartbeatAt: null,
    createdAt: new Date(),
    save: jest.fn(async () => {}),
    ...fields,
  });

  beforeEach(() => {
    mockMonitors.length = 0;
    mockChecks.length = 0;
    mockIncidents.length = 0;
  });

  test("a brand-new monitor that was never pinged is not marked down on the first tick", async () => {
    const m = heartbeat({ createdAt: new Date() });
    mockMonitors.push(m);
    await checkHeartbeatMonitors();
    expect(m.status).toBe("pending");
    expect(mockIncidents).toHaveLength(0);
  });

  test("a never-pinged monitor goes down once its grace period since creation has passed", async () => {
    const m = heartbeat({ createdAt: new Date(Date.now() - 120 * 1000) }); // grace = 1.5 x 60s
    mockMonitors.push(m);
    await checkHeartbeatMonitors();
    expect(m.status).toBe("down");
    expect(mockIncidents).toHaveLength(1);
    expect(mockChecks[0].errorMessage).toMatch(/^No heartbeat received in \d+ seconds$/);
  });

  test("an overdue monitor that was pinged before goes down", async () => {
    const m = heartbeat({
      createdAt: new Date(Date.now() - 86400 * 1000),
      lastHeartbeatAt: new Date(Date.now() - 100 * 1000),
      status: "up",
    });
    mockMonitors.push(m);
    await checkHeartbeatMonitors();
    expect(m.status).toBe("down");
  });

  test("a recently pinged monitor stays up", async () => {
    const m = heartbeat({ lastHeartbeatAt: new Date(Date.now() - 30 * 1000), status: "up" });
    mockMonitors.push(m);
    await checkHeartbeatMonitors();
    expect(m.status).toBe("up");
    expect(mockIncidents).toHaveLength(0);
  });
});
