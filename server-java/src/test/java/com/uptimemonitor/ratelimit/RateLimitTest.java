package com.uptimemonitor.ratelimit;

import com.uptimemonitor.support.ApiTestBase;
import com.uptimemonitor.support.TestApi;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import static org.assertj.core.api.Assertions.assertThat;

@TestPropertySource(properties = "app.rate-limit.enabled=true")
class RateLimitTest extends ApiTestBase {

    private TestApi.Response loginFrom(String ip) throws Exception {
        return api.exec(MockMvcRequestBuilders.post("/api/auth/login")
                .with(r -> {
                    r.setRemoteAddr(ip);
                    return r;
                })
                .contentType("application/json")
                .content("{\"email\":\"nobody@example.com\",\"password\":\"x\"}"));
    }

    @Test
    void loginLimiterAllowsTenPerWindowThenReturns429WithHeaders() throws Exception {
        String ip = "203.0.113.10";
        for (int i = 0; i < 10; i++) {
            TestApi.Response r = loginFrom(ip);
            assertThat(r.status()).isEqualTo(401);
            assertThat(r.header("RateLimit-Policy")).isEqualTo("10;w=900");
            assertThat(r.header("RateLimit")).startsWith("limit=10, remaining=" + (9 - i) + ",");
        }
        TestApi.Response limited = loginFrom(ip);
        assertThat(limited.status()).isEqualTo(429);
        assertThat(limited.error()).isEqualTo("Too many login attempts from this IP. Try again in 15 minutes.");
        assertThat(Integer.parseInt(limited.header("Retry-After"))).isPositive();

        // Buckets are per client IP.
        assertThat(loginFrom("203.0.113.11").status()).isEqualTo(401);
    }

    @Test
    void clientIpHonoursOneProxyHop() throws Exception {
        String realIp = "198.51.100.7";
        for (int i = 0; i < 5; i++) {
            api.exec(MockMvcRequestBuilders.post("/api/auth/register")
                    .header("X-Forwarded-For", "10.0.0.1, " + realIp)
                    .contentType("application/json").content("{}"));
        }
        TestApi.Response limited = api.exec(MockMvcRequestBuilders.post("/api/auth/register")
                .header("X-Forwarded-For", "10.9.9.9, " + realIp)
                .contentType("application/json").content("{}"));
        assertThat(limited.status()).isEqualTo(429);
        assertThat(limited.error()).isEqualTo("Too many registration attempts. Try again in an hour.");
    }

    @Test
    void unlimitedRoutesCarryNoRateLimitHeaders() throws Exception {
        assertThat(api.get("/api/health").header("RateLimit")).isNull();
    }
}
