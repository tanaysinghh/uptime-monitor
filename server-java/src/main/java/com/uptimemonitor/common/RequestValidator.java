package com.uptimemonitor.common;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Minimal port of the express-validator chains in server/src/middlewares/validators.js.
 * Rules operate on the raw JSON body (a Map) so type-coercion semantics match Node:
 * e.g. {@code isInt} accepts 30 and "30" but not 30.5 or "abc", and {@code optional()}
 * skips only absent keys (an explicit null is still validated).
 *
 * <p>Usage: call rule methods, then {@link #validate()} which throws a
 * {@link ValidationException} if any rule failed. Getter-style rules return the
 * sanitized value (trimmed string, normalized email, coerced int).
 */
public final class RequestValidator {

    public static final String DEFAULT_MESSAGE = "Invalid value";

    private static final Pattern INT = Pattern.compile("^[-+]?[0-9]+$");
    private static final Pattern UUID_PATTERN =
            Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    private final Map<String, Object> body;
    private final List<ValidationException.FieldError> errors = new ArrayList<>();

    private RequestValidator(Map<String, Object> body) {
        this.body = body == null ? Map.of() : body;
    }

    public static RequestValidator of(Map<String, Object> body) {
        return new RequestValidator(body);
    }

    /** Validates a path parameter as a UUID ("id must be a UUID") and throws immediately. */
    public static UUID uuidParam(String name, String value) {
        if (value == null || !UUID_PATTERN.matcher(value).matches()) {
            throw new ValidationException(List.of(
                    new ValidationException.FieldError(name, name + " must be a UUID")));
        }
        return UUID.fromString(value);
    }

    /** param(name).isUUID() collected with the body errors, as express-validator does. */
    public UUID pathUuid(String name, String value) {
        if (value == null || !UUID_PATTERN.matcher(value).matches()) {
            fail(name, name + " must be a UUID");
            return null;
        }
        return UUID.fromString(value);
    }

    public static boolean isUuid(String value) {
        return value != null && UUID_PATTERN.matcher(value).matches();
    }

    public boolean has(String field) {
        return body.containsKey(field);
    }

    public Object raw(String field) {
        return body.get(field);
    }

    public void validate() {
        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }
    }

    private void fail(String field, String message) {
        errors.add(new ValidationException.FieldError(field, message == null ? DEFAULT_MESSAGE : message));
    }

    // ---- strings -------------------------------------------------------------------

    /** body(field).isString().trim().isLength({min,max}) */
    public String string(String field, int min, int max, boolean trim, String message) {
        Object v = body.get(field);
        if (!(v instanceof String s)) {
            fail(field, message);
            return null;
        }
        String value = trim ? s.strip() : s;
        int len = value.codePointCount(0, value.length());
        if (len < min || len > max) {
            fail(field, message);
            return null;
        }
        return value;
    }

    public String optionalString(String field, int min, int max, boolean trim, String message) {
        return body.containsKey(field) ? string(field, min, max, trim, message) : null;
    }

    /** body(field).isString().notEmpty() */
    public String nonEmptyString(String field) {
        Object v = body.get(field);
        if (!(v instanceof String s) || s.isEmpty()) {
            fail(field, null);
            return null;
        }
        return s;
    }

    /** body(field).isEmail().normalizeEmail() */
    public String email(String field, String message) {
        Object v = body.get(field);
        if (!(v instanceof String s) || !EmailFormat.isEmail(s)) {
            fail(field, message);
            return null;
        }
        String normalized = EmailNormalizer.normalize(s);
        if (normalized == null) {
            fail(field, message);
        }
        return normalized;
    }

    /** body(field)[.optional()].isIn(values) */
    public String in(String field, Collection<String> allowed, boolean optional) {
        if (optional && !body.containsKey(field)) {
            return null;
        }
        Object v = body.get(field);
        String s = v == null ? null : scalarToString(v);
        if (s == null || !allowed.contains(s)) {
            fail(field, null);
            return null;
        }
        return s;
    }

    // ---- numbers -------------------------------------------------------------------

    /** body(field).optional().isInt({min,max}) - returns the coerced value or null */
    public Integer optionalInt(String field, int min, int max) {
        if (!body.containsKey(field)) {
            return null;
        }
        Integer value = toInt(body.get(field));
        if (value == null || value < min || value > max) {
            fail(field, null);
            return null;
        }
        return value;
    }

    // ---- structures ----------------------------------------------------------------

    /** body(field)[.optional()].isObject() - a JSON object, not an array or null */
    @SuppressWarnings("unchecked")
    public Map<String, Object> object(String field, boolean optional) {
        if (optional && !body.containsKey(field)) {
            return null;
        }
        Object v = body.get(field);
        if (!(v instanceof Map<?, ?> m)) {
            fail(field, null);
            return null;
        }
        return (Map<String, Object>) m;
    }

    /** body(field).optional().isArray() */
    public List<?> optionalArray(String field) {
        if (!body.containsKey(field)) {
            return null;
        }
        Object v = body.get(field);
        if (!(v instanceof List<?> list)) {
            fail(field, null);
            return null;
        }
        return list;
    }

    /** body(field).optional({ nullable }).isISO8601() */
    public Instant optionalIso8601(String field, boolean nullable) {
        if (!body.containsKey(field)) {
            return null;
        }
        Object v = body.get(field);
        if (v == null && nullable) {
            return null;
        }
        Instant parsed = v instanceof String s ? parseIso8601(s) : null;
        if (parsed == null) {
            fail(field, null);
        }
        return parsed;
    }

    // ---- helpers -------------------------------------------------------------------

    public static Integer toInt(Object v) {
        if (v instanceof Integer i) {
            return i;
        }
        if (v instanceof Long l && l >= Integer.MIN_VALUE && l <= Integer.MAX_VALUE) {
            return l.intValue();
        }
        if (v instanceof Number n) {
            double d = n.doubleValue();
            if (d == Math.rint(d) && !Double.isInfinite(d) && Math.abs(d) <= Integer.MAX_VALUE) {
                return (int) d;
            }
            return null;
        }
        if (v instanceof String s && INT.matcher(s).matches()) {
            try {
                return Integer.parseInt(s.startsWith("+") ? s.substring(1) : s);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private static String scalarToString(Object v) {
        if (v instanceof String || v instanceof Number || v instanceof Boolean) {
            return String.valueOf(v);
        }
        return null;
    }

    /** Accepts full ISO-8601 date-times (with or without offset) and plain dates. */
    public static Instant parseIso8601(String s) {
        try {
            return OffsetDateTime.parse(s).toInstant();
        } catch (DateTimeParseException ignored) {
            // fall through
        }
        try {
            return Instant.parse(s);
        } catch (DateTimeParseException ignored) {
            // fall through
        }
        try {
            return java.time.LocalDateTime.parse(s).toInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException ignored) {
            // fall through
        }
        try {
            return LocalDate.parse(s).atStartOfDay().toInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    public static final Set<String> MONITOR_METHODS = Set.of("GET", "POST", "HEAD", "PUT", "PATCH");
    public static final Set<String> MONITOR_STATUSES = Set.of("up", "down", "paused", "pending");
    public static final Set<String> ROLES = Set.of("admin", "editor", "viewer");
    public static final Set<String> CHANNEL_TYPES = Set.of("email", "webhook", "slack", "discord");
}
