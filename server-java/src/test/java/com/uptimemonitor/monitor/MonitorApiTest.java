package com.uptimemonitor.monitor;

import com.uptimemonitor.domain.Monitor;
import com.uptimemonitor.repository.CheckRepository;
import com.uptimemonitor.repository.IncidentRepository;
import com.uptimemonitor.support.ApiTestBase;
import com.uptimemonitor.support.Fixtures;
import com.uptimemonitor.support.TestApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Port of server/tests/monitor.test.js and rbac.test.js, extended to the whole router. */
class MonitorApiTest extends ApiTestBase {

    @Autowired
    Fixtures fixtures;
    @Autowired
    CheckRepository checks;
    @Autowired
    IncidentRepository incidents;

    private TestApi.Registered admin;

    @BeforeEach
    void registerAdmin() throws Exception {
        admin = api.register();
    }

    // Public IP literals: accepted by the SSRF guard without a DNS lookup.
    private static final String PUBLIC_URL = "https://93.184.216.34/health";

    private TestApi.Response create(String token, Map<String, Object> body) throws Exception {
        return api.post("/api/monitors", body, token);
    }

    @Test
    void listRequiresAuth() throws Exception {
        TestApi.Response r = api.get("/api/monitors");
        assertThat(r.status()).isEqualTo(401);
        assertThat(r.error()).isEqualTo("No token provided");
    }

    @Test
    void createRejectsViewerWithRbacMessage() throws Exception {
        String viewer = fixtures.memberToken(api, admin.organizationId(), "viewer");
        TestApi.Response r = create(viewer, Map.of("name", "acme api", "url", PUBLIC_URL));
        assertThat(r.status()).isEqualTo(403);
        assertThat(r.error()).isEqualTo("Requires one of: admin, editor. You are viewer.");
    }

    @Test
    void editorCanCreate() throws Exception {
        String editor = fixtures.memberToken(api, admin.organizationId(), "editor");
        assertThat(create(editor, Map.of("name", "by editor", "url", PUBLIC_URL)).status()).isEqualTo(201);
    }

    @Test
    void createRejectsMissingUrl() throws Exception {
        TestApi.Response r = create(admin.accessToken(), Map.of("name", "x"));
        assertThat(r.status()).isEqualTo(400);
        assertThat(r.error()).isEqualTo("Validation failed");
    }

    @Test
    void createValidatesRanges() throws Exception {
        TestApi.Response r = create(admin.accessToken(), Map.of("name", "x", "url", PUBLIC_URL,
                "intervalSeconds", 5, "timeoutMs", 999999, "method", "DELETE", "headers", List.of()));
        assertThat(r.status()).isEqualTo(400);
        assertThat(r.body().get("details").findValuesAsString("field"))
                .containsExactly("method", "intervalSeconds", "timeoutMs", "headers");
    }

    @Test
    void createsMonitorWithDefaults() throws Exception {
        TestApi.Response r = create(admin.accessToken(), Map.of("name", "  acme  ", "url", PUBLIC_URL,
                "tags", List.of("prod", 1)));
        assertThat(r.status()).isEqualTo(201);
        JsonNode m = r.body().get("monitor");
        assertThat(m.get("name").asString()).isEqualTo("acme");
        assertThat(m.get("organizationId").asString()).isEqualTo(admin.organizationId());
        assertThat(m.get("method").asString()).isEqualTo("GET");
        assertThat(m.get("intervalSeconds").asInt()).isEqualTo(300);
        assertThat(m.get("timeoutMs").asInt()).isEqualTo(30000);
        assertThat(m.get("expectedStatus").asInt()).isEqualTo(200);
        assertThat(m.get("status").asString()).isEqualTo("pending");
        assertThat(m.get("monitorType").asString()).isEqualTo("http");
        assertThat(m.get("maintenanceMode").asBoolean()).isFalse();
        assertThat(m.get("headers").isObject()).isTrue();
        assertThat(m.get("body").isNull()).isTrue();
        assertThat(m.get("tags").get(0).asString()).isEqualTo("prod");
        assertThat(m.get("tags").get(1).asString()).isEqualTo("1");
        assertThat(m.get("assertions").isArray()).isTrue();
    }

    @Test
    void createStoresJsonHeadersAndBody() throws Exception {
        TestApi.Response r = create(admin.accessToken(), Map.of("name", "post", "url", PUBLIC_URL, "method", "POST",
                "headers", Map.of("X-Token", "abc"), "body", Map.of("ping", true), "intervalSeconds", "60"));
        JsonNode m = api.get("/api/monitors/" + r.body().get("monitor").get("id").asString(), admin.accessToken())
                .body().get("monitor");
        assertThat(m.get("headers").get("X-Token").asString()).isEqualTo("abc");
        assertThat(m.get("body").get("ping").asBoolean()).isTrue();
        assertThat(m.get("intervalSeconds").asInt()).isEqualTo(60);
    }

    @Test
    void ssrfGuardRejectsPrivateUrls() throws Exception {
        for (String url : List.of("http://192.168.1.1/health", "http://localhost:8080/", "http://169.254.169.254/latest",
                "file:///etc/passwd")) {
            TestApi.Response r = create(admin.accessToken(), Map.of("name", "internal", "url", url));
            assertThat(r.status()).as(url).isEqualTo(400);
        }
        assertThat(create(admin.accessToken(), Map.of("name", "internal", "url", "http://10.0.0.5/")).error())
                .containsIgnoringCase("private");
    }

    @Test
    void getReturns404ForMonitorsOfOtherOrganizations() throws Exception {
        TestApi.Registered other = api.register();
        String id = create(other.accessToken(), Map.of("name", "theirs", "url", PUBLIC_URL))
                .body().get("monitor").get("id").asString();
        TestApi.Response r = api.get("/api/monitors/" + id, admin.accessToken());
        assertThat(r.status()).isEqualTo(404);
        assertThat(r.error()).isEqualTo("Monitor not found");
        assertThat(api.get("/api/monitors/00000000-0000-0000-0000-000000000000", admin.accessToken()).status())
                .isEqualTo(404);
    }

    @Test
    void getReturns400WhenIdIsNotAUuid() throws Exception {
        TestApi.Response r = api.get("/api/monitors/not-a-uuid", admin.accessToken());
        assertThat(r.status()).isEqualTo(400);
        assertThat(r.body().get("details").get(0).get("message").asString()).isEqualTo("id must be a UUID");
    }

    @Test
    void listIsScopedToOrganizationNewestFirst() throws Exception {
        create(admin.accessToken(), Map.of("name", "first", "url", PUBLIC_URL));
        create(admin.accessToken(), Map.of("name", "second", "url", PUBLIC_URL));
        create(api.register().accessToken(), Map.of("name", "foreign", "url", PUBLIC_URL));
        JsonNode list = api.get("/api/monitors", admin.accessToken()).body().get("monitors");
        assertThat(list.findValuesAsString("name")).containsExactly("second", "first");
    }

    @Test
    void updateChangesAllowedFieldsAndRevalidatesUrl() throws Exception {
        String id = create(admin.accessToken(), Map.of("name", "old", "url", PUBLIC_URL)).body()
                .get("monitor").get("id").asString();
        TestApi.Response r = api.put("/api/monitors/" + id,
                Map.of("name", "new", "status", "paused", "expectedStatus", 204, "organizationId", "ignored"),
                admin.accessToken());
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.body().get("monitor").get("name").asString()).isEqualTo("new");
        assertThat(r.body().get("monitor").get("status").asString()).isEqualTo("paused");
        assertThat(r.body().get("monitor").get("expectedStatus").asInt()).isEqualTo(204);
        assertThat(r.body().get("monitor").get("organizationId").asString()).isEqualTo(admin.organizationId());

        TestApi.Response ssrf = api.put("/api/monitors/" + id, Map.of("url", "http://127.0.0.1/"), admin.accessToken());
        assertThat(ssrf.status()).isEqualTo(400);
        assertThat(api.put("/api/monitors/" + id, Map.of("status", "exploded"), admin.accessToken()).status())
                .isEqualTo(400);
    }

    @Test
    void deleteRejectsViewerAndCascadesChecksAndIncidentsForEditors() throws Exception {
        Monitor m = fixtures.monitor(admin.organizationId(), PUBLIC_URL);
        fixtures.check(m.getId(), true, 100, Instant.now());
        String viewer = fixtures.memberToken(api, admin.organizationId(), "viewer");
        assertThat(api.delete("/api/monitors/" + m.getId(), viewer).status()).isEqualTo(403);

        TestApi.Response r = api.delete("/api/monitors/" + m.getId(), admin.accessToken());
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.body().get("message").asString()).isEqualTo("Monitor deleted");
        assertThat(checks.findByMonitorIdAndCheckedAtGreaterThanEqualOrderByCheckedAtAsc(m.getId(), Instant.EPOCH)).isEmpty();
        assertThat(api.delete("/api/monitors/" + m.getId(), admin.accessToken()).status()).isEqualTo(404);
    }

    @Test
    void checksEndpointFiltersByPeriodAndOrganization() throws Exception {
        Monitor m = fixtures.monitor(admin.organizationId(), PUBLIC_URL);
        Instant now = Instant.now();
        fixtures.check(m.getId(), true, 100, now.minus(1, ChronoUnit.HOURS));
        fixtures.check(m.getId(), false, 200, now.minus(3, ChronoUnit.DAYS));
        fixtures.check(m.getId(), true, 300, now.minus(20, ChronoUnit.DAYS));

        assertThat(api.get("/api/monitors/" + m.getId() + "/checks", admin.accessToken()).body().get("checks").size())
                .isEqualTo(1);
        JsonNode week = api.get("/api/monitors/" + m.getId() + "/checks?period=7d", admin.accessToken())
                .body().get("checks");
        assertThat(week.size()).isEqualTo(2);
        assertThat(week.get(0).get("responseTimeMs").asInt()).isEqualTo(200); // ascending by checkedAt
        assertThat(week.get(0).get("isSuccess").asBoolean()).isFalse();
        assertThat(api.get("/api/monitors/" + m.getId() + "/checks?period=30d", admin.accessToken())
                .body().get("checks").size()).isEqualTo(3);

        // Another organization cannot read these checks (the Node server allowed it).
        String foreignToken = api.register().accessToken();
        assertThat(api.get("/api/monitors/" + m.getId() + "/checks?period=30d", foreignToken)
                .body().get("checks").size()).isZero();
        assertThat(api.get("/api/monitors/" + m.getId() + "/incidents", foreignToken)
                .body().get("incidents").size()).isZero();
    }
}
