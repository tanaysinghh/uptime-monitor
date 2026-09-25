const mockMonitors = [];
const mockChecks = [];
const mockIncidents = [];

jest.mock("../src/models", () => ({
  Monitor: {
    findOne: async ({ where }) => mockMonitors.find((m) => m.heartbeatToken === where.heartbeatToken) || null,
    findAll: async ({ where }) => mockMonitors.filter((m) => m.organizationId === where.organizationId && m.status !== "paused"),
  },
  Check: {
    create: async (fields) => { mockChecks.push(fields); return fields; },
    findAll: async () => [],
  },
  Incident: {
    findOne: async () => null,
    findAll: async () => mockIncidents,
  },
  Organization: {
    findByPk: async () => ({ slug: "acme" }),
    findOne: async ({ where }) => (where.slug === "acme" ? { id: "org-1", name: "Acme", slug: "acme", logoUrl: null, brandColor: "#22c55e" } : null),
  },
}));
jest.mock("../src/services/alertService", () => ({ sendAlert: jest.fn(async () => {}) }));

const express = require("express");
const request = require("supertest");
const heartbeatRoutes = require("../src/routes/heartbeatRoutes");
const publicRoutes = require("../src/routes/publicRoutes");

const makeApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/heartbeat", heartbeatRoutes);
  app.use("/api/public", publicRoutes);
  return app;
};

const heartbeatMonitor = (fields) => ({
  id: "m-hb", organizationId: "org-1", name: "cron", heartbeatToken: "tok", monitorType: "heartbeat",
  status: "pending", consecutiveFailures: 0, save: jest.fn(async () => {}), ...fields,
});

beforeEach(() => {
  mockMonitors.length = 0;
  mockChecks.length = 0;
  mockIncidents.length = 0;
});

describe("heartbeat pings", () => {
  test("a ping to a paused monitor is recorded but does not un-pause it", async () => {
    const m = heartbeatMonitor({ status: "paused" });
    mockMonitors.push(m);
    const res = await request(makeApp()).get("/api/heartbeat/tok");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(m.status).toBe("paused");
    expect(m.lastHeartbeatAt).toBeInstanceOf(Date);
    expect(m.save).toHaveBeenCalled();
    expect(mockChecks).toHaveLength(1);
  });

  test("a ping to an active monitor marks it up", async () => {
    const m = heartbeatMonitor({ status: "pending" });
    mockMonitors.push(m);
    await request(makeApp()).post("/api/heartbeat/tok");
    expect(m.status).toBe("up");
  });
});

describe("public status page overallStatus", () => {
  test("a page with no public monitors is operational (not major_outage)", async () => {
    const res = await request(makeApp()).get("/api/public/status/acme");
    expect(res.status).toBe(200);
    expect(res.body.monitors).toEqual([]);
    expect(res.body.overallStatus).toBe("operational");
  });

  test("all monitors down is still a major outage", async () => {
    mockMonitors.push({ id: "m-1", organizationId: "org-1", name: "API", status: "down" });
    const res = await request(makeApp()).get("/api/public/status/acme");
    expect(res.body.overallStatus).toBe("major_outage");
  });
});
