const bcrypt = require("bcryptjs");
const speakeasy = require("speakeasy");
const { encrypt } = require("../src/utils/mfaCrypto");
const backupCodesUtil = require("../src/utils/backupCodes");

const mockUsers = new Map();
const mockOrgs = new Map();
const mockSessions = new Map();
const mockMfaChallenges = new Map();
const mockSecurityEvents = [];

const makeSaveable = (obj) => {
  obj.save = async function () { return this; };
  return obj;
};

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
        const id = fields.id || "u-" + (mockUsers.size + 1);
        const password = await bcryptLib.hash(fields.password, 4);
        const u = makeSaveable({
          ...fields,
          id,
          password,
          role: fields.role || "admin",
          failedLoginAttempts: 0,
          lockedUntil: null,
          mfaEnabled: false,
          mfaSecret: null,
          mfaBackupCodes: [],
          comparePassword: async function (c) { return bcryptLib.compare(c, this.password); },
          toJSON: function () { const { comparePassword, save, toJSON, ...rest } = this; return rest; },
        });
        mockUsers.set(id, u);
        return u;
      },
    },
    Organization: {
      findOne: async ({ where }) => {
        for (const o of mockOrgs.values()) if (where.slug && o.slug === where.slug) return o;
        return null;
      },
      create: async (fields) => {
        const id = "o-" + (mockOrgs.size + 1);
        const o = { ...fields, id };
        mockOrgs.set(id, o);
        return o;
      },
    },
    Session: {
      create: async (fields) => {
        const id = fields.id || "s-" + (mockSessions.size + 1);
        const s = makeSaveable({ ...fields, id, revokedAt: null });
        mockSessions.set(id, s);
        return s;
      },
      findByPk: async (id) => mockSessions.get(id) || null,
      findOne: async ({ where }) => {
        for (const s of mockSessions.values()) {
          if (s.id === where.id && s.userId === where.userId) return s;
        }
        return null;
      },
      findAll: async ({ where }) => {
        return [...mockSessions.values()].filter((s) => {
          if (where.userId && s.userId !== where.userId) return false;
          if (where.revokedAt === null && s.revokedAt != null) return false;
          return true;
        });
      },
      update: async (fields, { where }) => {
        let n = 0;
        for (const s of mockSessions.values()) {
          if (s.userId !== where.userId) continue;
          if (where.revokedAt === null && s.revokedAt != null) continue;
          if (where.id && where.id[Object.getOwnPropertySymbols(where.id)[0]] === s.id) continue;
          Object.assign(s, fields);
          n++;
        }
        return [n];
      },
    },
    MfaChallenge: {
      create: async (fields) => {
        const id = "c-" + (mockMfaChallenges.size + 1);
        const c = makeSaveable({ ...fields, id, usedAt: null });
        mockMfaChallenges.set(id, c);
        return c;
      },
      findByPk: async (id) => mockMfaChallenges.get(id) || null,
    },
    SecurityEvent: {
      create: async (fields) => {
        mockSecurityEvents.push(fields);
        return fields;
      },
      findAll: async ({ where }) => mockSecurityEvents.filter((e) => e.userId === where.userId),
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

const STRONG = "Tr0ub4dor&3xample!";

const registerUser = async (app, overrides = {}) => {
  const res = await request(app).post("/api/auth/register").send({
    email: "u@example.com",
    password: STRONG,
    name: "U",
    orgName: "Org",
    ...overrides,
  });
  return res;
};

describe("account lockout", () => {
  beforeEach(() => {
    mockUsers.clear();
    mockOrgs.clear();
    mockSessions.clear();
    mockSecurityEvents.length = 0;
  });

  test("5 failed logins lock the account; correct password still returns generic 401", async () => {
    const app = makeApp();
    await registerUser(app);

    for (let i = 0; i < 5; i++) {
      const r = await request(app).post("/api/auth/login").send({
        email: "u@example.com",
        password: "wrongpasswordXX",
      });
      expect(r.status).toBe(401);
      expect(r.body.error).toBe("Invalid credentials");
    }

    const now = await request(app).post("/api/auth/login").send({
      email: "u@example.com",
      password: STRONG,
    });
    expect(now.status).toBe(401);
    expect(now.body.error).toBe("Invalid credentials");
  });

  test("successful login resets the failed counter", async () => {
    const app = makeApp();
    await registerUser(app);

    for (let i = 0; i < 3; i++) {
      await request(app).post("/api/auth/login").send({
        email: "u@example.com",
        password: "wrongpasswordXX",
      });
    }
    const ok = await request(app).post("/api/auth/login").send({
      email: "u@example.com",
      password: STRONG,
    });
    expect(ok.status).toBe(200);

    const u = [...mockUsers.values()][0];
    expect(u.failedLoginAttempts).toBe(0);
    expect(u.lockedUntil).toBeNull();
  });

  test("SecurityEvent account_locked is recorded on the 5th failure", async () => {
    const app = makeApp();
    await registerUser(app);
    for (let i = 0; i < 5; i++) {
      await request(app).post("/api/auth/login").send({
        email: "u@example.com",
        password: "wrongpasswordXX",
      });
    }
    const locked = mockSecurityEvents.filter((e) => e.eventType === "account_locked");
    expect(locked.length).toBe(1);
  });
});

describe("MFA challenge flow", () => {
  const setupUser = async () => {
    mockUsers.clear(); mockOrgs.clear(); mockSessions.clear(); mockMfaChallenges.clear(); mockSecurityEvents.length = 0;
    const app = makeApp();
    const reg = await registerUser(app);
    expect(reg.status).toBe(201);
    const at = reg.body.accessToken;
    const secret = speakeasy.generateSecret({ length: 20 }).base32;
    const u = [...mockUsers.values()][0];
    u.mfaEnabled = true;
    u.mfaSecret = encrypt(secret);
    const codes = backupCodesUtil.generate();
    u.mfaBackupCodes = codes.map(backupCodesUtil.hash);
    return { app, at, secret, codes, user: u };
  };

  test("login returns mfaChallengeToken when mfaEnabled", async () => {
    const { app } = await setupUser();
    const res = await request(app).post("/api/auth/login").send({
      email: "u@example.com",
      password: STRONG,
    });
    expect(res.status).toBe(200);
    expect(res.body.requiresMfa).toBe(true);
    expect(res.body.mfaChallengeToken).toBeTruthy();
    expect(res.body.accessToken).toBeUndefined();
  });

  test("valid TOTP completes challenge, issues tokens", async () => {
    const { app, secret } = await setupUser();
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "u@example.com",
      password: STRONG,
    });
    const token = loginRes.body.mfaChallengeToken;
    const totp = speakeasy.totp({ secret, encoding: "base32" });
    const res = await request(app).post("/api/auth/mfa/challenge").send({
      mfaChallengeToken: token,
      code: totp,
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  test("wrong TOTP returns 401", async () => {
    const { app } = await setupUser();
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "u@example.com",
      password: STRONG,
    });
    const res = await request(app).post("/api/auth/mfa/challenge").send({
      mfaChallengeToken: loginRes.body.mfaChallengeToken,
      code: "000000",
    });
    expect(res.status).toBe(401);
    expect(mockSecurityEvents.some((e) => e.eventType === "mfa_challenge_failure")).toBe(true);
  });

  test("backup code works, consumes it, records backup_code_used", async () => {
    const { app, codes } = await setupUser();
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "u@example.com",
      password: STRONG,
    });
    const res = await request(app).post("/api/auth/mfa/challenge").send({
      mfaChallengeToken: loginRes.body.mfaChallengeToken,
      code: codes[2],
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(mockSecurityEvents.some((e) => e.eventType === "backup_code_used")).toBe(true);
    const u = [...mockUsers.values()][0];
    expect(u.mfaBackupCodes).toHaveLength(9);
  });

  test("challenge token is single-use", async () => {
    const { app, secret } = await setupUser();
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "u@example.com",
      password: STRONG,
    });
    const token = loginRes.body.mfaChallengeToken;
    const totp = speakeasy.totp({ secret, encoding: "base32" });
    const first = await request(app).post("/api/auth/mfa/challenge").send({
      mfaChallengeToken: token, code: totp,
    });
    expect(first.status).toBe(200);
    const second = await request(app).post("/api/auth/mfa/challenge").send({
      mfaChallengeToken: token, code: totp,
    });
    expect(second.status).toBe(401);
  });
});

describe("MFA challenge token scope", () => {
  test("challenge token is rejected as a Bearer token on protected routes", async () => {
    mockUsers.clear(); mockOrgs.clear(); mockSessions.clear(); mockMfaChallenges.clear(); mockSecurityEvents.length = 0;
    const app = makeApp();
    await registerUser(app);
    const u = [...mockUsers.values()][0];
    u.mfaEnabled = true;
    u.mfaSecret = encrypt(speakeasy.generateSecret({ length: 20 }).base32);

    const loginRes = await request(app).post("/api/auth/login").send({
      email: "u@example.com",
      password: STRONG,
    });
    const challengeToken = loginRes.body.mfaChallengeToken;
    expect(challengeToken).toBeTruthy();

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${challengeToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid token");
  });

  test("regular access tokens still authenticate", async () => {
    mockUsers.clear(); mockOrgs.clear(); mockSessions.clear();
    const app = makeApp();
    const reg = await registerUser(app);
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${reg.body.accessToken}`);
    expect(res.status).not.toBe(401);
  });
});

describe("GET /auth/me", () => {
  test("exposes the organization as both Organization and organization", async () => {
    mockUsers.clear(); mockOrgs.clear(); mockSessions.clear();
    const app = makeApp();
    const reg = await registerUser(app);
    const u = [...mockUsers.values()][0];
    u.Organization = { id: "o-1", slug: "org" };
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${reg.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.Organization).toEqual({ id: "o-1", slug: "org" });
    expect(res.body.user.organization).toEqual({ id: "o-1", slug: "org" });
  });
});

describe("session revocation", () => {
  beforeEach(() => {
    mockUsers.clear(); mockOrgs.clear(); mockSessions.clear(); mockSecurityEvents.length = 0;
  });

  test("revoked session's refresh token is rejected", async () => {
    const app = makeApp();
    const reg = await registerUser(app);
    const rt = reg.body.refreshToken;

    const session = [...mockSessions.values()][0];
    session.revokedAt = new Date();

    const res = await request(app).post("/api/auth/refresh-token").send({
      refreshToken: rt,
    });
    expect(res.status).toBe(401);
  });

  test("refresh rotates the token; the old one no longer works", async () => {
    const app = makeApp();
    const reg = await registerUser(app);
    const oldRt = reg.body.refreshToken;

    const first = await request(app).post("/api/auth/refresh-token").send({
      refreshToken: oldRt,
    });
    expect(first.status).toBe(200);
    const newRt = first.body.refreshToken;
    expect(newRt).not.toBe(oldRt);

    const replay = await request(app).post("/api/auth/refresh-token").send({
      refreshToken: oldRt,
    });
    expect(replay.status).toBe(401);
  });
});
