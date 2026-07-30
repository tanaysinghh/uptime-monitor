const jwt = require("jsonwebtoken");

const mockMonitors = new Map();
const mockUsers = new Map();

jest.mock("../src/models", () => ({
  sequelize: {
    transaction: async (fn) => fn({}),
  },
  User: {
    findByPk: async (id) => mockUsers.get(id) || null,
  },
  Monitor: {
    create: async (fields) => {
      const id = "m-" + (mockMonitors.size + 1);
      const monitor = { ...fields, id, save: jest.fn(), destroy: jest.fn() };
      mockMonitors.set(id, monitor);
      return monitor;
    },
    findAll: async ({ where }) => {
      return [...mockMonitors.values()].filter(
        (m) => !where.organizationId || m.organizationId === where.organizationId
      );
    },
    findOne: async ({ where }) => {
      for (const m of mockMonitors.values()) {
        if (m.id === where.id && m.organizationId === where.organizationId) return m;
      }
      return null;
    },
  },
  Check: { destroy: async () => 0, findAll: async () => [] },
  Incident: { destroy: async () => 0, findAll: async () => [] },
}));

jest.mock("../src/config/database", () => ({
  transaction: async (fn) => fn({}),
}));

const express = require("express");
const request = require("supertest");
const monitorRoutes = require("../src/routes/monitorRoutes");

const makeApp = () => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use("/api/monitors", monitorRoutes);
  return app;
};

const tokenFor = (user) => jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "15m" });

describe("monitor routes", () => {
  const admin = { id: "u-admin", role: "admin", organizationId: "org-1" };
  const viewer = { id: "u-viewer", role: "viewer", organizationId: "org-1" };

  beforeEach(() => {
    mockMonitors.clear();
    mockUsers.clear();
    mockUsers.set(admin.id, admin);
    mockUsers.set(viewer.id, viewer);
    process.env.ALLOW_PRIVATE_URLS = "true";
  });

  test("GET / requires auth", async () => {
    const res = await request(makeApp()).get("/api/monitors");
    expect(res.status).toBe(401);
  });

  test("POST / rejects viewer role", async () => {
    const res = await request(makeApp())
      .post("/api/monitors")
      .set("Authorization", `Bearer ${tokenFor(viewer)}`)
      .send({ name: "acme api", url: "https://acme.co/health" });
    expect(res.status).toBe(403);
  });

  test("POST / rejects invalid URL", async () => {
    const res = await request(makeApp())
      .post("/api/monitors")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ name: "x" });
    expect(res.status).toBe(400);
  });

  test("POST / creates monitor for admin", async () => {
    const res = await request(makeApp())
      .post("/api/monitors")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ name: "acme", url: "https://acme.co/health" });
    expect(res.status).toBe(201);
    expect(res.body.monitor.name).toBe("acme");
    expect(res.body.monitor.organizationId).toBe("org-1");
  });

  test("SSRF: POST / rejects private URL when guard on", async () => {
    delete process.env.ALLOW_PRIVATE_URLS;
    const res = await request(makeApp())
      .post("/api/monitors")
      .set("Authorization", `Bearer ${tokenFor(admin)}`)
      .send({ name: "internal", url: "http://192.168.1.1/health" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/private/i);
  });

  test("GET /:id 404 when monitor not in org", async () => {
    const res = await request(makeApp())
      .get("/api/monitors/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${tokenFor(admin)}`);
    expect(res.status).toBe(404);
  });

  test("GET /:id 400 when id not a UUID", async () => {
    const res = await request(makeApp())
      .get("/api/monitors/not-a-uuid")
      .set("Authorization", `Bearer ${tokenFor(admin)}`);
    expect(res.status).toBe(400);
  });

  test("DELETE /:id rejects viewer", async () => {
    const res = await request(makeApp())
      .delete("/api/monitors/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${tokenFor(viewer)}`);
    expect(res.status).toBe(403);
  });
});
