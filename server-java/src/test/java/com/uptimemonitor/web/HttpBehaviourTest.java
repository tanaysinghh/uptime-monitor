package com.uptimemonitor.web;

import com.uptimemonitor.support.ApiTestBase;
import com.uptimemonitor.support.TestApi;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import static org.assertj.core.api.Assertions.assertThat;

/** App-level behaviour from app.js: health, 404 catch-all, helmet headers, CORS, request ids. */
class HttpBehaviourTest extends ApiTestBase {

    @Test
    void healthChecksTheDatabase() throws Exception {
        TestApi.Response r = api.get("/api/health");
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.body().get("status").asString()).isEqualTo("ok");
        assertThat(r.body().get("db").asString()).isEqualTo("ok");
        assertThat(r.body().has("dbError")).isFalse();
        assertThat(r.body().has("uptimeSeconds")).isTrue();
        assertThat(r.body().has("checkTimeMs")).isTrue();
        assertThat(r.body().get("timestamp").asString()).endsWith("Z");
    }

    @Test
    void actuatorHealthIsExposed() throws Exception {
        TestApi.Response r = api.get("/actuator/health");
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.body().get("status").asString()).isEqualTo("UP");
    }

    @Test
    void unknownRoutesReturnTheExactCatchAllBody() throws Exception {
        for (String path : new String[]{"/api/nope", "/api/auth/unknown", "/something"}) {
            TestApi.Response r = api.get(path);
            assertThat(r.status()).as(path).isEqualTo(404);
            assertThat(r.body().toString()).as(path).isEqualTo("{\"error\":\"Not found\"}");
        }
        // wrong method on an existing public path is also a 404 in Express
        assertThat(api.delete("/api/auth/login", null).status()).isEqualTo(404);
    }

    @Test
    void routersWithRouterLevelAuthReturn401ForUnknownSubpaths() throws Exception {
        assertThat(api.get("/api/monitors/a/b/c").status()).isEqualTo(401);
    }

    @Test
    void helmetHeadersAreSet() throws Exception {
        TestApi.Response r = api.get("/api/health");
        assertThat(r.header("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(r.header("X-Frame-Options")).isEqualTo("SAMEORIGIN");
        assertThat(r.header("Strict-Transport-Security")).isEqualTo("max-age=31536000; includeSubDomains");
        assertThat(r.header("Content-Security-Policy")).startsWith("default-src 'self'");
        assertThat(r.header("Referrer-Policy")).isEqualTo("no-referrer");
        assertThat(r.header("Cross-Origin-Opener-Policy")).isEqualTo("same-origin");
    }

    @Test
    void requestIdIsEchoedOrGenerated() throws Exception {
        TestApi.Response generated = api.get("/api/health");
        assertThat(generated.header("X-Request-Id")).matches("[0-9a-f-]{36}");
        TestApi.Response echoed = api.exec(MockMvcRequestBuilders.get("/api/health").header("X-Request-Id", "abc-12345678"));
        assertThat(echoed.header("X-Request-Id")).isEqualTo("abc-12345678");
        TestApi.Response rejected = api.exec(MockMvcRequestBuilders.get("/api/health").header("X-Request-Id", "bad id!"));
        assertThat(rejected.header("X-Request-Id")).isNotEqualTo("bad id!");
    }

    @Test
    void corsAllowsTheClientOriginWithCredentials() throws Exception {
        TestApi.Response r = api.exec(MockMvcRequestBuilders.options("/api/auth/login")
                .header("Origin", "http://localhost:5173")
                .header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "content-type,authorization"));
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.header("Access-Control-Allow-Origin")).isEqualTo("http://localhost:5173");
        assertThat(r.header("Access-Control-Allow-Credentials")).isEqualTo("true");

        TestApi.Response other = api.exec(MockMvcRequestBuilders.options("/api/auth/login")
                .header("Origin", "https://evil.example")
                .header("Access-Control-Request-Method", "POST"));
        assertThat(other.header("Access-Control-Allow-Origin")).isNull();
    }

    @Test
    void malformedJsonIsA400() throws Exception {
        TestApi.Response r = api.post("/api/auth/login", "{\"email\":");
        assertThat(r.status()).isEqualTo(400);
        assertThat(r.error()).isNotBlank();
    }
}
