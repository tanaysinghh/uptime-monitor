const { validateEnv } = require("../src/config/env");

describe("validateEnv", () => {
  const original = { ...process.env };
  let exitSpy;

  beforeEach(() => {
    process.env = { ...original };
    exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...original };
    exitSpy.mockRestore();
    console.error.mockRestore();
  });

  test("passes with all required vars set in test env", () => {
    const env = validateEnv();
    expect(env.nodeEnv).toBe("test");
    expect(env.isProd).toBe(false);
  });

  test("exits when a required var is missing", () => {
    delete process.env.JWT_SECRET;
    expect(() => validateEnv()).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test("in production rejects short JWT secret", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "short";
    expect(() => validateEnv()).toThrow("process.exit called");
  });

  test("in production rejects placeholder secret", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "your_super_secret_key_change_this_in_production";
    process.env.JWT_REFRESH_SECRET = "another_reasonably_long_random_string_here_ok_ok";
    expect(() => validateEnv()).toThrow("process.exit called");
  });

  test("in production rejects duplicate JWT secrets", () => {
    process.env.NODE_ENV = "production";
    const same = "a_reasonably_long_random_secret_that_is_over_32_chars";
    process.env.JWT_SECRET = same;
    process.env.JWT_REFRESH_SECRET = same;
    expect(() => validateEnv()).toThrow("process.exit called");
  });
});
