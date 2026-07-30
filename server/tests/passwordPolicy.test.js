const { evaluatePassword } = require("../src/utils/passwordPolicy");

describe("evaluatePassword", () => {
  test("rejects too short", () => {
    const r = evaluatePassword("Ab1!");
    expect(r.ok).toBe(false);
  });

  test("rejects extremely common", () => {
    const r = evaluatePassword("password12345");
    expect(r.ok).toBe(false);
  });

  test("rejects too long", () => {
    const r = evaluatePassword("a".repeat(300));
    expect(r.ok).toBe(false);
  });

  test("rejects password identical to a user input", () => {
    const r = evaluatePassword("acmeacmeacme", ["acmeacmeacme"]);
    expect(r.ok).toBe(false);
  });

  test("accepts a strong passphrase", () => {
    const r = evaluatePassword("correct horse battery staple x9");
    expect(r.ok).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(2);
  });

  test("accepts a random mix", () => {
    const r = evaluatePassword("Tr0ub4dor&3xample!");
    expect(r.ok).toBe(true);
  });
});
