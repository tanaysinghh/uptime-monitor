package com.uptimemonitor.monitor;

import com.uptimemonitor.domain.Incident;
import com.uptimemonitor.domain.Monitor;
import com.uptimemonitor.repository.IncidentRepository;
import com.uptimemonitor.repository.MonitorRepository;
import com.uptimemonitor.support.ApiTestBase;
import com.uptimemonitor.support.Fixtures;
import com.uptimemonitor.support.TestApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Limit;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class HeartbeatAndMaintenanceTest extends ApiTestBase {

    @Autowired
    HeartbeatService heartbeats;
    @Autowired
    MonitorRepository monitors;
    @Autowired
    IncidentRepository incidents;
    @Autowired
    Fixtures fixtures;

    private TestApi.Registered admin;

    @BeforeEach
    void registerAdmin() throws Exception {
        admin = api.register();
    }

    private JsonNode createHeartbeat(int interval) throws Exception {
        TestApi.Response r = api.post("/api/heartbeat/monitors",
                Map.of("name", "nightly backup", "heartbeatInterval", interval, "tags", List.of("cron")),
                admin.accessToken());
        assertThat(r.status()).isEqualTo(201);
        return r.body();
    }

    private Monitor reload(String id) {
        return monitors.findById(UUID.fromString(id)).orElseThrow();
    }

    @Test
    void createHeartbeatMonitor() throws Exception {
        JsonNode body = createHeartbeat(60);
        JsonNode m = body.get("monitor");
        String token = m.get("heartbeatToken").asString();
        assertThat(token).matches("[0-9a-f]{32}");
        assertThat(body.get("pingUrl").asString()).isEqualTo("/api/heartbeat/" + token);
        assertThat(m.get("url").asString()).isEqualTo("heartbeat://" + token);
        assertThat(m.get("monitorType").asString()).isEqualTo("heartbeat");
        assertThat(m.get("heartbeatInterval").asInt()).isEqualTo(60);
        assertThat(m.get("intervalSeconds").asInt()).isEqualTo(60);
        assertThat(m.get("status").asString()).isEqualTo("pending");

        String viewer = fixtures.memberToken(api, admin.organizationId(), "viewer");
        assertThat(api.post("/api/heartbeat/monitors", Map.of("name", "x"), viewer).status()).isEqualTo(403);
        assertThat(api.post("/api/heartbeat/monitors", Map.of("name", "x")).status()).isEqualTo(401);
        assertThat(api.post("/api/heartbeat/monitors", Map.of("name", "x", "heartbeatInterval", 5),
                admin.accessToken()).status()).isEqualTo(400);
    }

    @Test
    void pingsViaGetAndPostMarkTheMonitorUp() throws Exception {
        JsonNode m = createHeartbeat(60).get("monitor");
        String token = m.get("heartbeatToken").asString();

        TestApi.Response get = api.get("/api/heartbeat/" + token);
        assertThat(get.status()).isEqualTo(200);
        assertThat(get.body().get("status").asString()).isEqualTo("ok");
        assertThat(get.body().get("received").asString()).endsWith("Z");
        assertThat(api.post("/api/heartbeat/" + token, null).status()).isEqualTo(200);

        Monitor after = reload(m.get("id").asString());
        assertThat(after.getStatus()).isEqualTo("up");
        assertThat(after.getLastHeartbeatAt()).isNotNull();

        TestApi.Response unknown = api.get("/api/heartbeat/nope");
        assertThat(unknown.status()).isEqualTo(404);
        assertThat(unknown.error()).isEqualTo("Heartbeat monitor not found");
        // GET on the literal "monitors" segment is treated as a token, like Express
        assertThat(api.get("/api/heartbeat/monitors").error()).isEqualTo("Heartbeat monitor not found");
    }

    @Test
    void missedHeartbeatOpensIncidentAndNextPingResolvesIt() throws Exception {
        JsonNode m = createHeartbeat(60).get("monitor");
        String id = m.get("id").asString();
        String token = m.get("heartbeatToken").asString();
        api.get("/api/heartbeat/" + token);

        Monitor overdue = reload(id);
        overdue.setLastHeartbeatAt(Instant.now().minusSeconds(120)); // grace = 1.5 x 60s
        monitors.save(overdue);
        heartbeats.checkHeartbeatMonitors();

        Monitor down = reload(id);
        assertThat(down.getStatus()).isEqualTo("down");
        List<Incident> open = incidents.findByMonitorIdOrderByStartedAtDesc(down.getId(), Limit.of(5));
        assertThat(open).hasSize(1);
        assertThat(open.get(0).getStatus()).isEqualTo("investigating");
        JsonNode checks = api.get("/api/monitors/" + id + "/checks", admin.accessToken()).body().get("checks");
        assertThat(checks.get(checks.size() - 1).get("errorMessage").asString()).matches("No heartbeat received in \\d+ seconds");

        heartbeats.checkHeartbeatMonitors(); // already down: no duplicate incident
        assertThat(incidents.findByMonitorIdOrderByStartedAtDesc(down.getId(), Limit.of(5))).hasSize(1);

        api.get("/api/heartbeat/" + token);
        assertThat(reload(id).getStatus()).isEqualTo("up");
        assertThat(incidents.findByMonitorIdOrderByStartedAtDesc(down.getId(), Limit.of(5)).get(0).getStatus())
                .isEqualTo("resolved");
    }

    @Test
    void newHeartbeatMonitorGetsAGracePeriodBeforeTheFirstPing() throws Exception {
        String id = createHeartbeat(60).get("monitor").get("id").asString();
        heartbeats.checkHeartbeatMonitors();
        assertThat(reload(id).getStatus()).isEqualTo("pending");
    }

    @Test
    void pingToAPausedMonitorIsRecordedWithoutUnpausing() throws Exception {
        JsonNode m = createHeartbeat(60).get("monitor");
        api.put("/api/monitors/" + m.get("id").asString(), Map.of("status", "paused"), admin.accessToken());
        api.get("/api/heartbeat/" + m.get("heartbeatToken").asString());
        Monitor after = reload(m.get("id").asString());
        assertThat(after.getStatus()).isEqualTo("paused");
        assertThat(after.getLastHeartbeatAt()).isNotNull();
    }

    // ---- maintenance -----------------------------------------------------------------

    @Test
    void maintenanceWindowEnableDisable() throws Exception {
        Monitor m = fixtures.monitor(admin.organizationId(), "https://93.184.216.34/");
        TestApi.Response enabled = api.post("/api/maintenance/monitors/" + m.getId() + "/enable",
                Map.of("reason", "DB upgrade", "endAt", "2030-01-01T00:00:00Z"), admin.accessToken());
        assertThat(enabled.status()).isEqualTo(200);
        JsonNode mon = enabled.body().get("monitor");
        assertThat(mon.get("maintenanceMode").asBoolean()).isTrue();
        assertThat(mon.get("maintenanceReason").asString()).isEqualTo("DB upgrade");
        assertThat(mon.get("maintenanceEndAt").asString()).isEqualTo("2030-01-01T00:00:00.000Z");
        assertThat(mon.get("maintenanceStartAt").isNull()).isFalse();

        TestApi.Response defaults = api.post("/api/maintenance/monitors/" + m.getId() + "/enable", null, admin.accessToken());
        assertThat(defaults.body().get("monitor").get("maintenanceReason").asString()).isEqualTo("Scheduled maintenance");

        TestApi.Response disabled = api.post("/api/maintenance/monitors/" + m.getId() + "/disable", null, admin.accessToken());
        assertThat(disabled.body().get("monitor").get("maintenanceMode").asBoolean()).isFalse();
        assertThat(disabled.body().get("monitor").get("maintenanceReason").isNull()).isTrue();

        JsonNode logs = api.get("/api/team/audit-log", admin.accessToken()).body().get("logs");
        assertThat(logs.findValuesAsString("action"))
                .containsExactly("disable_maintenance", "enable_maintenance", "enable_maintenance");
        assertThat(logs.get(2).get("details").get("reason").asString()).isEqualTo("DB upgrade");
        assertThat(logs.get(1).get("details").size()).isZero();
    }

    @Test
    void maintenanceRequiresEditorAndValidInput() throws Exception {
        Monitor m = fixtures.monitor(admin.organizationId(), "https://93.184.216.34/");
        String viewer = fixtures.memberToken(api, admin.organizationId(), "viewer");
        assertThat(api.post("/api/maintenance/monitors/" + m.getId() + "/enable", null, viewer).error())
                .isEqualTo("Requires one of: admin, editor. You are viewer.");
        assertThat(api.post("/api/maintenance/monitors/" + m.getId() + "/enable", Map.of("endAt", "soon"),
                admin.accessToken()).status()).isEqualTo(400);
        assertThat(api.post("/api/maintenance/monitors/" + UUID.randomUUID() + "/enable", null,
                admin.accessToken()).status()).isEqualTo(404);
        assertThat(api.post("/api/maintenance/monitors/bad/disable", null, admin.accessToken()).status()).isEqualTo(400);
    }
}
