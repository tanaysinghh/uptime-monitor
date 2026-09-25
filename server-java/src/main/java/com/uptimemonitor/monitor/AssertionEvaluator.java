package com.uptimemonitor.monitor;

import com.uptimemonitor.common.JsNumbers;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Port of utils/assertions.js. Monitor assertions are user-authored JSON evaluated with
 * JavaScript semantics in the Node server, so the JS coercions that affect results are
 * reproduced here: {@code String(x)} vs {@code JSON.stringify(x)}, {@code Number(x)},
 * {@code parseInt}, and undefined vs null when walking a JSON path.
 */
public final class AssertionEvaluator {

    /** JavaScript's undefined (a missing property), distinct from JSON null. */
    static final Object UNDEFINED = new Object() {
        @Override
        public String toString() {
            return "undefined";
        }
    };

    private static final Pattern ARRAY_PART = Pattern.compile("^(.+)\\[(\\d+)]$");
    private static final Pattern ROOT = Pattern.compile("^\\$\\.?");
    private static final Pattern PARSE_INT = Pattern.compile("^\\s*([+-]?\\d+)");
    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    public record Evaluation(boolean passed, List<Map<String, Object>> results) {
    }

    private AssertionEvaluator() {
    }

    public static Evaluation evaluate(List<Map<String, Object>> assertions, Object responseBody, Integer statusCode) {
        if (assertions == null || assertions.isEmpty()) {
            return new Evaluation(true, List.of());
        }
        List<Map<String, Object>> results = new ArrayList<>();
        for (Map<String, Object> assertion : assertions) {
            try {
                results.add(evaluateOne(assertion, responseBody, statusCode));
            } catch (RuntimeException e) {
                results.add(result(assertion, false, "Error: " + e.getMessage()));
            }
        }
        boolean allPassed = results.stream().allMatch(r -> Boolean.TRUE.equals(r.get("passed")));
        return new Evaluation(allPassed, results);
    }

    private static Map<String, Object> evaluateOne(Map<String, Object> a, Object body, Integer statusCode) {
        String type = a.get("type") == null ? null : String.valueOf(a.get("type"));
        Object value = a.containsKey("value") ? a.get("value") : UNDEFINED;
        if (type == null) {
            return result(a, false, "Unknown assertion type");
        }
        switch (type) {
            case "body_contains":
            case "body_not_contains": {
                boolean isString = body instanceof String;
                boolean contains = isString && ((String) body).contains(jsString(value));
                boolean passed = isString && (type.equals("body_contains") == contains);
                return result(a, passed, isString ? "Body length: " + ((String) body).length() : "Non-string body");
            }
            case "json_path":
                return jsonPath(a, body, value);
            case "response_time":
                return result(a, true, "Evaluated after check");
            case "status_code": {
                Double expected = parseInt(value);
                boolean passed = statusCode != null && expected != null && statusCode.doubleValue() == expected;
                return result(a, passed, String.valueOf(statusCode));
            }
            default:
                return result(a, false, "Unknown assertion type");
        }
    }

    private static Map<String, Object> jsonPath(Map<String, Object> a, Object body, Object value) {
        Object parsed = body;
        if (body instanceof String s) {
            try {
                parsed = MAPPER.readValue(s, Object.class);
            } catch (RuntimeException e) {
                return result(a, false, "Invalid JSON response");
            }
        }
        Object rawPath = a.get("path");
        if (!(rawPath instanceof String path)) {
            throw new IllegalArgumentException("Cannot read properties of undefined (reading 'replace')");
        }
        String[] parts = ROOT.matcher(path).replaceFirst("").split("\\.", -1);
        Object current = parsed;
        for (String part : parts) {
            if (current == null || current == UNDEFINED) {
                return result(a, false, "Path not found");
            }
            Matcher m = ARRAY_PART.matcher(part);
            if (m.matches()) {
                current = property(current, m.group(1));
                if (current instanceof List<?> list) {
                    int idx = Integer.parseInt(m.group(2));
                    current = idx < list.size() ? list.get(idx) : UNDEFINED;
                } else {
                    return result(a, false, "Not an array at " + m.group(1));
                }
            } else {
                current = property(current, part);
            }
        }

        String actual = isJsObject(current) ? MAPPER.writeValueAsString(current) : jsString(current);
        String operator = a.get("operator") == null ? "undefined" : String.valueOf(a.get("operator"));
        return switch (operator) {
            case "equals" -> result(a, jsString(current).equals(jsString(value)), actual);
            case "not_equals" -> result(a, !jsString(current).equals(jsString(value)), actual);
            case "contains" -> result(a, actual.contains(jsString(value)), actual);
            case "greater_than" -> result(a, jsNumber(current) > jsNumber(value), actual);
            case "less_than" -> result(a, jsNumber(current) < jsNumber(value), actual);
            default -> result(a, false, "Unknown operator: " + operator);
        };
    }

    private static Map<String, Object> result(Map<String, Object> assertion, boolean passed, String actual) {
        Map<String, Object> r = new LinkedHashMap<>(assertion);
        r.put("passed", passed);
        r.put("actual", actual);
        return r;
    }

    /** obj[key] */
    private static Object property(Object obj, String key) {
        if (obj instanceof Map<?, ?> map) {
            return map.containsKey(key) ? map.get(key) : UNDEFINED;
        }
        if (obj instanceof List<?> list) {
            if (key.equals("length")) {
                return list.size();
            }
            Integer idx = arrayIndex(key);
            return idx != null && idx < list.size() ? list.get(idx) : UNDEFINED;
        }
        if (obj instanceof String s) {
            if (key.equals("length")) {
                return s.length();
            }
            Integer idx = arrayIndex(key);
            return idx != null && idx < s.length() ? String.valueOf(s.charAt(idx)) : UNDEFINED;
        }
        return UNDEFINED;
    }

    private static Integer arrayIndex(String key) {
        if (!key.matches("^(0|[1-9]\\d{0,8})$")) {
            return null;
        }
        return Integer.parseInt(key);
    }

    /** typeof x === "object" (objects, arrays and null) */
    private static boolean isJsObject(Object v) {
        return v == null || v instanceof Map || v instanceof List;
    }

    /** String(x) */
    static String jsString(Object v) {
        if (v == null) return "null";
        if (v == UNDEFINED) return "undefined";
        if (v instanceof String s) return s;
        if (v instanceof Boolean b) return b.toString();
        if (v instanceof Number n) return jsNumberString(n);
        if (v instanceof Map) return "[object Object]";
        if (v instanceof List<?> list) {
            List<String> parts = new ArrayList<>();
            for (Object o : list) {
                parts.add(o == null || o == UNDEFINED ? "" : jsString(o));
            }
            return String.join(",", parts);
        }
        return String.valueOf(v);
    }

    static String jsNumberString(Number n) {
        return JsNumbers.toString(n);
    }

    /** Number(x) */
    static double jsNumber(Object v) {
        if (v == null) return 0;
        if (v == UNDEFINED) return Double.NaN;
        if (v instanceof Boolean b) return b ? 1 : 0;
        if (v instanceof Number n) return n.doubleValue();
        if (v instanceof String s) {
            String t = s.strip();
            if (t.isEmpty()) return 0;
            try {
                if (t.matches("(?i)^0x[0-9a-f]+$")) return Long.parseLong(t.substring(2), 16);
                if (t.equals("Infinity") || t.equals("+Infinity")) return Double.POSITIVE_INFINITY;
                if (t.equals("-Infinity")) return Double.NEGATIVE_INFINITY;
                if (!t.matches("^[+-]?(\\d+\\.?\\d*|\\.\\d+)([eE][+-]?\\d+)?$")) return Double.NaN;
                return Double.parseDouble(t);
            } catch (NumberFormatException e) {
                return Double.NaN;
            }
        }
        if (v instanceof List) return jsNumber(jsString(v));
        return Double.NaN;
    }

    /** parseInt(x): leading integer prefix of String(x), or null for NaN. */
    static Double parseInt(Object v) {
        Matcher m = PARSE_INT.matcher(jsString(v));
        return m.find() ? Double.parseDouble(m.group(1)) : null;
    }

    /** JavaScript truthiness. */
    static boolean truthy(Object v) {
        if (v == null || v == UNDEFINED) return false;
        if (v instanceof Boolean b) return b;
        if (v instanceof Number n) return n.doubleValue() != 0 && !Double.isNaN(n.doubleValue());
        if (v instanceof String s) return !s.isEmpty();
        return true;
    }
}
