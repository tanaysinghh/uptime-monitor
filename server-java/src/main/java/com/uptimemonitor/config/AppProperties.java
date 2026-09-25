package com.uptimemonitor.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        @DefaultValue("development") String env,
        @DefaultValue("http://localhost:5173") String clientUrl,
        @DefaultValue("false") boolean allowPrivateUrls,
        Jwt jwt,
        String mfaEncryptionKey,
        @DefaultValue RateLimit rateLimit,
        @DefaultValue Scheduler scheduler,
        @DefaultValue Socket socket) {

    public boolean isProd() {
        return "production".equals(env);
    }

    public boolean isTest() {
        return "test".equals(env);
    }

    public record Jwt(String secret, String refreshSecret,
                      @DefaultValue("15m") String expiresIn,
                      @DefaultValue("7d") String refreshExpiresIn) {
    }

    public record RateLimit(@DefaultValue("true") boolean enabled) {
    }

    public record Scheduler(@DefaultValue("true") boolean enabled) {
    }

    public record Socket(@DefaultValue("true") boolean enabled, @DefaultValue("5001") int port) {
    }
}
