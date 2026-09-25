const jwt = require("jsonwebtoken");

const mockUsers = new Map();

// Mimics Sequelize: an `attributes` array selects columns, { exclude } drops them.
const mockProject = (row, attributes) => {
  if (Array.isArray(attributes)) {
    return Object.fromEntries(attributes.filter((a) => a in row).map((a) => [a, row[a]]));
  }
  if (attributes && attributes.exclude) {
    return Object.fromEntries(Object.entries(row).filter(([k]) => !attributes.exclude.includes(k)));
  }
  return { ...row };
};

jest.mock("../src/models", () => ({
  User: {
    findByPk: async (id) => mockUsers.get(id) || null,
    findAll: async ({ where, attributes }) =>
      [...mockUsers.values()]
        .filter((u) => u.organizationId === where.organizationId)
        .map((u) => mockProject(u, attributes)),
  },
  Organization: {},
  AuditLog: {},
  Session: {},
}));

const express = require("express");
const request = require("supertest");
const teamRoutes = require("../src/routes/teamRoutes");
const { MEMBER_ATTRIBUTES } = require("../src/controllers/teamController");

const makeApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/team", teamRoutes);
  return app;
};

const SENSITIVE = ["password", "mfaSecret", "mfaBackupCodes", "failedLoginAttempts", "lockedUntil", "passwordChangedAt"];

describe("GET /api/team/members", () => {
  beforeEach(() => {
    mockUsers.clear();
    mockUsers.set("u-admin", {
      id: "u-admin", email: "admin@example.com", name: "Admin", role: "admin", organizationId: "org-1",
      password: "$2a$12$hash", mfaEnabled: true, mfaSecret: "encrypted-totp-secret",
      mfaBackupCodes: ["h1", "h2"], failedLoginAttempts: 2, lockedUntil: null, passwordChangedAt: null,
      isVerified: true,
    });
    mockUsers.set("u-viewer", {
      id: "u-viewer", email: "viewer@example.com", name: "Viewer", role: "viewer", organizationId: "org-1",
      password: "$2a$12$hash2", mfaEnabled: false, mfaSecret: null, mfaBackupCodes: [], isVerified: true,
    });
  });

  test("never returns credentials, MFA secrets or lockout state", async () => {
    const token = jwt.sign({ userId: "u-viewer" }, process.env.JWT_SECRET, { expiresIn: "15m" });
    const res = await request(makeApp()).get("/api/team/members").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(2);
    for (const member of res.body.members) {
      for (const field of SENSITIVE) expect(member).not.toHaveProperty(field);
    }
    const admin = res.body.members.find((m) => m.id === "u-admin");
    expect(admin).toMatchObject({ email: "admin@example.com", name: "Admin", role: "admin", mfaEnabled: true });
  });

  test("the attribute allowlist contains no sensitive column", () => {
    for (const field of SENSITIVE) expect(MEMBER_ATTRIBUTES).not.toContain(field);
    expect(MEMBER_ATTRIBUTES).toEqual(expect.arrayContaining(["id", "email", "name", "role"]));
  });
});
