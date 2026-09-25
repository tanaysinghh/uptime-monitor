package com.uptimemonitor.monitor;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Port of server/tests/assertions.test.js plus the JavaScript-coercion edge cases. */
class AssertionEvaluatorTest {

    private static AssertionEvaluator.Evaluation eval(Map<String, Object> assertion, String body, Integer status) {
        return AssertionEvaluator.evaluate(List.of(assertion), body, status);
    }

    @Test
    void passesWithNoAssertions() {
        assertThat(AssertionEvaluator.evaluate(List.of(), "", 200).passed()).isTrue();
        assertThat(AssertionEvaluator.evaluate(null, "", 200).passed()).isTrue();
    }

    @Test
    void statusCodeEquals() {
        var r = eval(Map.of("type", "status_code", "value", 200), "", 200);
        assertThat(r.passed()).isTrue();
        assertThat(r.results().get(0).get("actual")).isEqualTo("200");
    }

    @Test
    void statusCodeMismatchFails() {
        assertThat(eval(Map.of("type", "status_code", "value", 200), "", 500).passed()).isFalse();
    }

    @Test
    void statusCodeUsesParseIntSemantics() {
        assertThat(eval(Map.of("type", "status_code", "value", "200abc"), "", 200).passed()).isTrue();
        assertThat(eval(Map.of("type", "status_code", "value", "abc"), "", 200).passed()).isFalse();
    }

    @Test
    void bodyContainsPassesWhenSubstringPresent() {
        assertThat(eval(Map.of("type", "body_contains", "value", "ok"), "response ok body", 200).passed()).isTrue();
    }

    @Test
    void bodyContainsFailsWhenSubstringAbsent() {
        var r = eval(Map.of("type", "body_contains", "value", "missing"), "hi", 200);
        assertThat(r.passed()).isFalse();
        assertThat(r.results().get(0).get("actual")).isEqualTo("Body length: 2");
    }

    @Test
    void bodyNotContains() {
        assertThat(eval(Map.of("type", "body_not_contains", "value", "error"), "all good", 200).passed()).isTrue();
        assertThat(eval(Map.of("type", "body_not_contains", "value", "good"), "all good", 200).passed()).isFalse();
    }

    @Test
    void jsonPathEqualsExtractsNestedField() {
        var r = eval(Map.of("type", "json_path", "path", "$.data.status", "operator", "equals", "value", "healthy"),
                "{\"data\":{\"status\":\"healthy\"}}", 200);
        assertThat(r.passed()).isTrue();
    }

    @Test
    void jsonPathGreaterThanWorks() {
        var r = eval(Map.of("type", "json_path", "path", "$.count", "operator", "greater_than", "value", 10),
                "{\"count\":42}", 200);
        assertThat(r.passed()).isTrue();
        assertThat(r.results().get(0).get("actual")).isEqualTo("42");
    }

    @Test
    void unknownAssertionTypeFails() {
        var r = eval(Map.of("type", "nope"), "", 200);
        assertThat(r.passed()).isFalse();
        assertThat(r.results().get(0).get("actual")).isEqualTo("Unknown assertion type");
    }

    @Test
    void returnsActualForDebuggingAndKeepsOriginalFields() {
        var r = eval(Map.of("type", "status_code", "value", 200), "x", 404);
        assertThat(r.results().get(0)).containsEntry("passed", false).containsEntry("actual", "404")
                .containsEntry("type", "status_code").containsEntry("value", 200);
    }

    @Test
    void jsonPathArrayIndexingAndErrors() {
        String body = "{\"items\":[{\"id\":7},{\"id\":8}],\"name\":\"x\"}";
        assertThat(eval(Map.of("type", "json_path", "path", "$.items[1].id", "operator", "equals", "value", "8"),
                body, 200).passed()).isTrue();
        assertThat(eval(Map.of("type", "json_path", "path", "$.name[0]", "operator", "equals", "value", "x"),
                body, 200).results().get(0).get("actual")).isEqualTo("Not an array at name");
        assertThat(eval(Map.of("type", "json_path", "path", "$.missing.deeper", "operator", "equals", "value", "x"),
                body, 200).results().get(0).get("actual")).isEqualTo("Path not found");
        assertThat(eval(Map.of("type", "json_path", "path", "$.a", "operator", "equals", "value", "x"),
                "not json", 200).results().get(0).get("actual")).isEqualTo("Invalid JSON response");
    }

    @Test
    void jsonPathActualUsesJsonStringifyForObjectsAndStringForScalars() {
        String body = "{\"obj\":{\"a\":1},\"arr\":[1,2],\"nil\":null,\"flag\":true}";
        assertThat(eval(Map.of("type", "json_path", "path", "$.obj", "operator", "contains", "value", "\"a\":1"),
                body, 200).passed()).isTrue();
        assertThat(eval(Map.of("type", "json_path", "path", "$.arr", "operator", "equals", "value", "1,2"),
                body, 200).passed()).isTrue();
        assertThat(eval(Map.of("type", "json_path", "path", "$.nil", "operator", "equals", "value", "null"),
                body, 200).results().get(0).get("actual")).isEqualTo("null");
        assertThat(eval(Map.of("type", "json_path", "path", "$.absent", "operator", "equals", "value", "undefined"),
                body, 200).passed()).isTrue();
        assertThat(eval(Map.of("type", "json_path", "path", "$.flag", "operator", "equals", "value", true),
                body, 200).passed()).isTrue();
    }

    @Test
    void unknownOperatorFails() {
        var r = eval(Map.of("type", "json_path", "path", "$.a", "operator", "matches", "value", "x"), "{\"a\":1}", 200);
        assertThat(r.results().get(0).get("actual")).isEqualTo("Unknown operator: matches");
    }

    @Test
    void responseTimeIsDeferredToTheCheck() {
        var r = eval(Map.of("type", "response_time", "value", 500), "", 200);
        assertThat(r.passed()).isTrue();
        assertThat(r.results().get(0).get("actual")).isEqualTo("Evaluated after check");
    }

    @Test
    void nonStringBodyNeverContains() {
        var r = AssertionEvaluator.evaluate(List.of(Map.of("type", "body_contains", "value", "x")), null, 200);
        assertThat(r.passed()).isFalse();
        assertThat(r.results().get(0).get("actual")).isEqualTo("Non-string body");
    }

    @Test
    void javascriptNumberFormatting() {
        assertThat(AssertionEvaluator.jsNumberString(1.0)).isEqualTo("1");
        assertThat(AssertionEvaluator.jsNumberString(1.5)).isEqualTo("1.5");
        assertThat(AssertionEvaluator.jsNumberString(1e21)).isEqualTo("1e+21");
        assertThat(AssertionEvaluator.jsNumberString(1e-7)).isEqualTo("1e-7");
        assertThat(AssertionEvaluator.jsNumber("  42 ")).isEqualTo(42);
        assertThat(AssertionEvaluator.jsNumber("")).isZero();
        assertThat(AssertionEvaluator.jsNumber("12px")).isNaN();
    }
}
