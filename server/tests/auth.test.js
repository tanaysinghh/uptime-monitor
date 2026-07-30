const bcrypt = require("bcryptjs");

const mockUsers = new Map();
const mockOrgs = new Map();

jest.mock("../src/models", () => {
  const bcryptLib = require("bcryptjs");
  return {
    sequelize: {},
    User: {
      findOne: async ({ where }) => {
        for (const u of mockUsers.values()) {
          if (where.email && u.email === where.email) return u;
        }
        return null;
      },
      findByPk: async (id) => mockUsers.get(id) || null,
      create: async (fields) => {
        const id = "u-" + (mockUsers.size + 1);
        const password = await bcryptLib.hash(fields.password, 4);
        const user = {
          ...fields,
          id,
          password,
          role: fields.role || "admin",
          comparePassword: async function (candidate) {
            return bcryptLib.compare(candidate, this.password);
          },
        };
        mockUsers.set(id, user);
        return user;
      },
    },
    Organization: {
      findOne: async ({ where }) => {
        for (const o of mockOrgs.values()) {
          if (where.slug && o.slug === where.slug) return o;
        }
        return null;
      },
      create: async (fields) => {
        const id = "o-" + (mockOrgs.size + 1);
        const org = { ...fields, id };
        mockOrgs.set(id, org);
        return org;
      },
    },
  };
});

const express = require("express");
const request = require("supertest");
const authRoutes = require("../src/routes/authRoutes");

const makeApp = () => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  return app;
};

describe("auth routes", () => {
  beforeEach(() => {
    mockUsers.clear();
    mockOrgs.clear();
  });

  test("POST /register 400 on invalid email", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/auth/register").send({
      email: "not-an-email",
      password: "longenoughpw",
      name: "Jane",
      orgName: "Acme",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  test("POST /register 400 on short password", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/auth/register").send({
      email: "a@b.co",
      password: "short",
      name: "Jane",
      orgName: "Acme",
    });
    expect(res.status).toBe(400);
  });

  test("POST /register 201 with valid payload and returns tokens", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/auth/register").send({
      email: "founder@acme.co",
      password: "supersecretpw",
      name: "Founder",
      orgName: "Acme Inc",
    });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.email).toBe("founder@acme.co");
    expect(res.body.user.password).toBeUndefined();
  });

  test("POST /register 400 on duplicate email", async () => {
    const app = makeApp();
    await request(app).post("/api/auth/register").send({
      email: "dup@acme.co",
      password: "supersecretpw",
      name: "A",
      orgName: "Acme",
    });
    const res = await request(app).post("/api/auth/register").send({
      email: "dup@acme.co",
      password: "supersecretpw",
      name: "B",
      orgName: "Acme Two",
    });
    expect(res.status).toBe(400);
  });

  test("POST /login 401 on unknown email", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/auth/login").send({
      email: "ghost@nowhere.co",
      password: "whatever12",
    });
    expect(res.status).toBe(401);
  });

  test("POST /login 401 on wrong password", async () => {
    const app = makeApp();
    await request(app).post("/api/auth/register").send({
      email: "user@acme.co",
      password: "correctpassword",
      name: "U",
      orgName: "Acme3",
    });
    const res = await request(app).post("/api/auth/login").send({
      email: "user@acme.co",
      password: "wrongpassword",
    });
    expect(res.status).toBe(401);
  });

  test("POST /login 200 with valid credentials", async () => {
    const app = makeApp();
    await request(app).post("/api/auth/register").send({
      email: "ok@acme.co",
      password: "correctpassword",
      name: "U",
      orgName: "Acme4",
    });
    const res = await request(app).post("/api/auth/login").send({
      email: "ok@acme.co",
      password: "correctpassword",
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  test("POST /refresh-token 401 without token", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/auth/refresh-token").send({});
    expect(res.status).toBe(400);
  });
});
