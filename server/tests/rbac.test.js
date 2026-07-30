const { requireRole, requireAdmin, requireEditor } = require("../src/middlewares/rbac");

const mockRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe("requireRole", () => {
  test("401 when no user", () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();
    requireRole("admin")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("403 when role not allowed", () => {
    const req = { user: { role: "viewer" } };
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("passes for admin on requireAdmin", () => {
    const req = { user: { role: "admin" } };
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("editor passes requireEditor but not requireAdmin", () => {
    const req = { user: { role: "editor" } };
    const okNext = jest.fn();
    requireEditor(req, mockRes(), okNext);
    expect(okNext).toHaveBeenCalled();

    const failRes = mockRes();
    const failNext = jest.fn();
    requireAdmin(req, failRes, failNext);
    expect(failRes.status).toHaveBeenCalledWith(403);
    expect(failNext).not.toHaveBeenCalled();
  });

  test("viewer blocked from requireEditor", () => {
    const req = { user: { role: "viewer" } };
    const res = mockRes();
    const next = jest.fn();
    requireEditor(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
