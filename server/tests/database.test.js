describe("database config", () => {
  const orig = process.env.DB_SSL;
  afterEach(() => {
    if (orig === undefined) delete process.env.DB_SSL;
    else process.env.DB_SSL = orig;
    jest.resetModules();
  });

  test("DB_SSL=true requires TLS with certificate verification (Neon)", () => {
    process.env.DB_SSL = "true";
    const sequelize = require("../src/config/database");
    expect(sequelize.options.dialectOptions).toEqual({ ssl: { require: true, rejectUnauthorized: true } });
  });

  test("without DB_SSL no TLS options are set (local Postgres)", () => {
    delete process.env.DB_SSL;
    const sequelize = require("../src/config/database");
    expect(sequelize.options.dialectOptions).toEqual({});
  });
});
