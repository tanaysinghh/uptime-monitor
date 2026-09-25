package com.uptimemonitor.common;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * An expected, client-facing failure. Rendered as {@code {"error": message, ...extra}}
 * with the given HTTP status, matching {@code res.status(n).json({ error })} in Node.
 */
public class ApiException extends RuntimeException {

    private final int status;
    private final Map<String, Object> extra;

    public ApiException(int status, String message) {
        this(status, message, Map.of());
    }

    public ApiException(int status, String message, Map<String, Object> extra) {
        super(message);
        this.status = status;
        this.extra = extra;
    }

    public int getStatus() {
        return status;
    }

    public Map<String, Object> body() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", getMessage());
        body.putAll(extra);
        return body;
    }

    public static ApiException badRequest(String message) {
        return new ApiException(400, message);
    }

    public static ApiException unauthorized(String message) {
        return new ApiException(401, message);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(403, message);
    }

    public static ApiException notFound(String message) {
        return new ApiException(404, message);
    }
}
