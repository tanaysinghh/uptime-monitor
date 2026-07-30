const { evaluateAssertions } = require("../src/utils/assertions");

describe("evaluateAssertions", () => {
  test("returns passed=true with no assertions", () => {
    expect(evaluateAssertions([], "", 200).passed).toBe(true);
    expect(evaluateAssertions(null, "", 200).passed).toBe(true);
  });

  test("status_code equals", () => {
    const r = evaluateAssertions([{ type: "status_code", value: 200 }], "", 200);
    expect(r.passed).toBe(true);
    expect(r.results[0].actual).toBe("200");
  });

  test("status_code mismatch fails", () => {
    const r = evaluateAssertions([{ type: "status_code", value: 200 }], "", 500);
    expect(r.passed).toBe(false);
  });

  test("body_contains passes when substring present", () => {
    const r = evaluateAssertions(
      [{ type: "body_contains", value: "ok" }],
      "response ok body",
      200
    );
    expect(r.passed).toBe(true);
  });

  test("body_contains fails when substring absent", () => {
    const r = evaluateAssertions([{ type: "body_contains", value: "missing" }], "hi", 200);
    expect(r.passed).toBe(false);
  });

  test("json_path equals extracts nested field", () => {
    const body = JSON.stringify({ data: { status: "healthy" } });
    const r = evaluateAssertions(
      [{ type: "json_path", path: "$.data.status", operator: "equals", value: "healthy" }],
      body,
      200
    );
    expect(r.passed).toBe(true);
  });

  test("json_path greater_than works", () => {
    const body = JSON.stringify({ count: 42 });
    const r = evaluateAssertions(
      [{ type: "json_path", path: "$.count", operator: "greater_than", value: 10 }],
      body,
      200
    );
    expect(r.passed).toBe(true);
  });

  test("unknown assertion type fails", () => {
    const r = evaluateAssertions([{ type: "nope" }], "", 200);
    expect(r.passed).toBe(false);
  });

  test("returns actual for debugging", () => {
    const r = evaluateAssertions([{ type: "status_code", value: 200 }], "x", 404);
    expect(r.results[0]).toMatchObject({ passed: false, actual: "404" });
  });
});
