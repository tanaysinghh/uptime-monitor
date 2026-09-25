package com.uptimemonitor.ratelimit;

import java.time.Duration;

/** The limiters from middlewares/rateLimiters.js, with identical windows, caps and messages. */
public enum Limiter {
    AUTH(20, Duration.ofMinutes(15), "Too many auth attempts. Try again in 15 minutes."),
    LOGIN(10, Duration.ofMinutes(15), "Too many login attempts from this IP. Try again in 15 minutes."),
    MFA(10, Duration.ofMinutes(5), "Too many MFA attempts. Try again in 5 minutes."),
    REGISTER(5, Duration.ofHours(1), "Too many registration attempts. Try again in an hour."),
    /** Keyed by the heartbeat token path variable rather than the client IP. */
    HEARTBEAT(60, Duration.ofMinutes(1), Limiter.DEFAULT_MESSAGE),
    PUBLIC(30, Duration.ofMinutes(1), Limiter.DEFAULT_MESSAGE),
    SUBSCRIBE(5, Duration.ofHours(1), "Too many subscription attempts from this IP.");

    static final String DEFAULT_MESSAGE = "Too many requests, please try again later.";

    private final int limit;
    private final Duration window;
    private final String message;

    Limiter(int limit, Duration window, String message) {
        this.limit = limit;
        this.window = window;
        this.message = message;
    }

    public int limit() {
        return limit;
    }

    public Duration window() {
        return window;
    }

    public String message() {
        return message;
    }
}
