const { handleError } = require("../src/utils/errorResponse");

const mockRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe("handleError", () => {
  const orig = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = orig;
  });

  test("dev leaks message", () => {
    process.env.NODE_ENV = "development";
    const res = mockRes();
    handleError(res, new Error("db exploded"));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db exploded" });
  });

  test("prod hides 5xx message", () => {
    process.env.NODE_ENV = "production";
    const res = mockRes();
    handleError(res, new Error("db exploded"));
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });

  test("prod passes through client 4xx message", () => {
    process.env.NODE_ENV = "production";
    const res = mockRes();
    handleError(res, new Error("bad input"), 400);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "bad input" });
  });
});
