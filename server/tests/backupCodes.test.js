const backupCodes = require("../src/utils/backupCodes");

describe("backupCodes", () => {
  test("generates 10 unique xxxx-xxxx codes", () => {
    const codes = backupCodes.generate();
    expect(codes).toHaveLength(10);
    for (const c of codes) {
      expect(c).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    }
    expect(new Set(codes).size).toBe(10);
  });

  test("hash is deterministic and dash/case insensitive", () => {
    const h1 = backupCodes.hash("ABCD-EFGH");
    const h2 = backupCodes.hash("abcdefgh");
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  test("consumeMatching removes the matched hash, leaves others", () => {
    const codes = backupCodes.generate();
    const hashes = codes.map(backupCodes.hash);
    const { matched, remaining } = backupCodes.consumeMatching(codes[3], hashes);
    expect(matched).toBe(true);
    expect(remaining).toHaveLength(9);
    expect(remaining).not.toContain(hashes[3]);
  });

  test("consumeMatching returns matched=false and full list on miss", () => {
    const hashes = backupCodes.generate().map(backupCodes.hash);
    const { matched, remaining } = backupCodes.consumeMatching("XXXX-XXXX", hashes);
    expect(matched).toBe(false);
    expect(remaining).toHaveLength(10);
  });
});
