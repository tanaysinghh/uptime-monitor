package com.uptimemonitor.config;

import java.util.List;
import java.util.function.Function;
import java.util.regex.Pattern;

/**
 * Port of server/src/config/env.js: required variables must be present, and in
 * production the JWT secrets and MFA key must be strong and distinct.
 */
public final class EnvValidator {

    public static final List<String> REQUIRED_VARS = List.of(
            "DB_HOST",
            "DB_PORT",
            "DB_NAME",
            "DB_USER",
            "DB_PASSWORD",
            "JWT_SECRET",
            "JWT_REFRESH_SECRET",
            "JWT_EXPIRES_IN",
            "JWT_REFRESH_EXPIRES_IN",
            "CLIENT_URL",
            "MFA_ENCRYPTION_KEY");

    static final int MIN_SECRET_LENGTH = 32;

    private static final Pattern PLACEHOLDER =
            Pattern.compile("change[_-]?this|your[_-]?super[_-]?secret|example|placeholder", Pattern.CASE_INSENSITIVE);

    public record Result(String nodeEnv, boolean isProd, int port, String clientUrl, boolean allowPrivateUrls) {
    }

    public static class EnvValidationException extends RuntimeException {
        public EnvValidationException(String message) {
            super(message);
        }
    }

    private EnvValidator() {
    }

    public static Result validate(Function<String, String> env) {
        List<String> missing = REQUIRED_VARS.stream()
                .filter(k -> isBlank(env.apply(k)))
                .toList();
        if (!missing.isEmpty()) {
            throw new EnvValidationException("FATAL: missing required environment variables: "
                    + String.join(", ", missing) + "\nSee .env.example for the full list.");
        }

        String nodeEnv = isBlank(env.apply("NODE_ENV")) ? "development" : env.apply("NODE_ENV");
        boolean isProd = "production".equals(nodeEnv);

        if (isProd) {
            for (String secret : List.of("JWT_SECRET", "JWT_REFRESH_SECRET")) {
                String value = env.apply(secret);
                if (value.length() < MIN_SECRET_LENGTH) {
                    throw new EnvValidationException("FATAL: " + secret + " must be at least "
                            + MIN_SECRET_LENGTH + " characters in production.");
                }
                if (PLACEHOLDER.matcher(value).find()) {
                    throw new EnvValidationException("FATAL: " + secret
                            + " looks like a placeholder value. Set a real secret.");
                }
            }
            if (env.apply("JWT_SECRET").equals(env.apply("JWT_REFRESH_SECRET"))) {
                throw new EnvValidationException("FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be different.");
            }
            String mfaKeyHex = env.apply("MFA_ENCRYPTION_KEY").replaceAll("(?i)[^0-9a-f]", "");
            if (mfaKeyHex.length() != 64) {
                throw new EnvValidationException("FATAL: MFA_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). "
                        + "Generate with: openssl rand -hex 32");
            }
        }

        // HS256 needs a >= 256-bit key; jjwt refuses shorter ones, so enforce it in every
        // environment rather than failing on the first login.
        for (String secret : List.of("JWT_SECRET", "JWT_REFRESH_SECRET")) {
            if (env.apply(secret).getBytes(java.nio.charset.StandardCharsets.UTF_8).length < MIN_SECRET_LENGTH) {
                throw new EnvValidationException("FATAL: " + secret + " must be at least "
                        + MIN_SECRET_LENGTH + " bytes (HS256 key size).");
            }
        }

        int port;
        try {
            port = Integer.parseInt(String.valueOf(env.apply("PORT")).trim());
        } catch (NumberFormatException e) {
            port = 5000;
        }

        return new Result(nodeEnv, isProd, port, env.apply("CLIENT_URL"),
                "true".equals(env.apply("ALLOW_PRIVATE_URLS")));
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
