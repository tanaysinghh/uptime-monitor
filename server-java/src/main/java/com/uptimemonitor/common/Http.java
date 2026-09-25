package com.uptimemonitor.common;

import jakarta.servlet.http.HttpServletRequest;

/** Request helpers shared by controllers, security and rate limiting. */
public final class Http {

    private Http() {
    }

    /**
     * Client IP with Express {@code trust proxy = 1} semantics: trust exactly one hop, so
     * the address is the right-most X-Forwarded-For entry, else the socket address.
     */
    public static String clientIp(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            String[] parts = xff.split(",");
            String last = parts[parts.length - 1].trim();
            if (!last.isEmpty()) {
                return last;
            }
        }
        return request.getRemoteAddr();
    }

    /** User-Agent truncated to the 500-char column width, "" when absent (as in Node). */
    public static String userAgent(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String ua = request.getHeader("User-Agent");
        if (ua == null) {
            return "";
        }
        return ua.length() > 500 ? ua.substring(0, 500) : ua;
    }
}
