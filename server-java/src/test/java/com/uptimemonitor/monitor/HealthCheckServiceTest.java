package com.uptimemonitor.monitor;

import com.sun.net.httpserver.HttpServer;
import com.uptimemonitor.alert.AlertService;
import com.uptimemonitor.domain.Check;
import com.uptimemonitor.domain.Incident;
import com.uptimemonitor.domain.Monitor;
import com.uptimemonitor.realtime.RealtimeEvents;
import com.uptimemonitor.repository.IncidentRepository;
import com.uptimemonitor.repository.MonitorRepository;
import com.uptimemonitor.support.ApiTestBase;
import com.uptimemonitor.support.Fixtures;
import com.uptimemonitor.support.TestApi;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Limit;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** The check engine end to end against a real local HTTP server and database. */
class HealthCheckServiceTest extends ApiTestBase {

    @Autowired
    HealthCheckService healthChecks;
    @Autowired
    MonitorRepository monitors;
    @Autowired
    IncidentRepository incidents;
    @Autowired
    Fixtures fixtures;

    @MockitoBean
    RealtimeEvents realtime;
    @MockitoBean
    AlertService alerts;

    private HttpServer server;
    private final AtomicInteger status = new AtomicInteger(200);
    private final AtomicReference<String> body = new AtomicReference<>("{\"status\":\"healthy\"}");
    private final AtomicInteger delayMs = new AtomicInteger(0);
    private final AtomicReference<String> lastMethod = new AtomicReference<>();
    private final AtomicReference<String> lastRequestBody = new AtomicReference<>();
    private final AtomicReference<String> lastHeader = new AtomicReference<>();
    private TestApi.Registered org;

    @BeforeEach
    void startServer() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            lastMethod.set(exchange.getRequestMethod());
            lastHeader.set(exchange.getRequestHeaders().getFirst("X-Probe"));
            lastRequestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            try {
                Thread.sleep(delayMs.get());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            byte[] bytes = body.get().getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status.get(), bytes.length == 0 ? -1 : bytes.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(bytes);
            } catch (IOException ignored) {
                // client gave up (timeout test)
            }
        });
        server.start();
        org = api.register();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    private String url() {
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/health";
    }

    private Monitor reload(Monitor m) {
        return monitors.findById(m.getId()).orElseThrow();
    }

    @Test
    void successfulCheckMarksMonitorUpAndEmitsCheckResult() {
        Monitor m = fixtures.monitor(org.organizationId(), url());
        Check check = healthChecks.performCheck(m);

        assertThat(check.getIsSuccess()).isTrue();
        assertThat(check.getStatusCode()).isEqualTo(200);
        assertThat(check.getResponseTimeMs()).isNotNull().isGreaterThanOrEqualTo(0);
        Monitor after = reload(m);
        assertThat(after.getStatus()).isEqualTo("up");
        assertThat(after.getLastCheckedAt()).isNotNull();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> result = ArgumentCaptor.forClass(Map.class);
        verify(realtime).emitCheckResult(eq(m.getOrganizationId()), result.capture());
        assertThat(result.getValue()).containsEntry("isSuccess", true).containsEntry("statusCode", 200)
                .containsKeys("sslInfo", "assertionResults", "checkedAt");
        // pending -> up is a status change
        verify(realtime).emitMonitorUpdate(eq(m.getOrganizationId()), anyMap());
    }

    @Test
    void threeConsecutiveFailuresOpenOneIncidentAndRecoveryResolvesIt() {
        Monitor m = fixtures.monitor(org.organizationId(), url());
        status.set(503);

        healthChecks.performCheck(reload(m));
        healthChecks.performCheck(reload(m));
        assertThat(reload(m).getStatus()).isEqualTo("pending");
        assertThat(reload(m).getConsecutiveFailures()).isEqualTo(2);

        Check third = healthChecks.performCheck(reload(m));
        assertThat(third.getErrorMessage()).isEqualTo("Expected status 200, got 503");
        assertThat(reload(m).getStatus()).isEqualTo("down");
        List<Incident> open = incidents.findByMonitorIdOrderByStartedAtDesc(m.getId(), Limit.of(5));
        assertThat(open).hasSize(1);
        assertThat(open.get(0).getStatus()).isEqualTo("investigating");
        verify(alerts).sendAlertAsync(any(), any(), eq("down"));

        healthChecks.performCheck(reload(m)); // still failing: no second incident
        assertThat(incidents.findByMonitorIdOrderByStartedAtDesc(m.getId(), Limit.of(5))).hasSize(1);

        status.set(200);
        healthChecks.performCheck(reload(m));
        Monitor recovered = reload(m);
        assertThat(recovered.getStatus()).isEqualTo("up");
        assertThat(recovered.getConsecutiveFailures()).isZero();
        Incident resolved = incidents.findByMonitorIdOrderByStartedAtDesc(m.getId(), Limit.of(5)).get(0);
        assertThat(resolved.getStatus()).isEqualTo("resolved");
        assertThat(resolved.getResolvedAt()).isNotNull();
        assertThat(resolved.getDurationSeconds()).isNotNull().isGreaterThanOrEqualTo(0);
        verify(alerts).sendAlertAsync(any(), any(), eq("up"));
        verify(realtime, atLeastOnce()).emitIncidentUpdate(eq(m.getOrganizationId()), eq(org.slug()), anyMap());
    }

    @Test
    void sendsConfiguredMethodHeadersAndJsonBody() {
        Monitor m = fixtures.monitor(org.organizationId(), url());
        m.setMethod("POST");
        m.setHeaders(Map.of("X-Probe", "yes", "Host", "ignored.example"));
        m.setBody(Map.of("ping", 1));
        monitors.save(m);

        assertThat(healthChecks.performCheck(reload(m)).getIsSuccess()).isTrue();
        assertThat(lastMethod.get()).isEqualTo("POST");
        assertThat(lastHeader.get()).isEqualTo("yes");
        assertThat(lastRequestBody.get()).isEqualTo("{\"ping\":1}");
    }

    @Test
    void failedAssertionsFailTheCheckWithDetails() {
        Monitor m = fixtures.monitor(org.organizationId(), url());
        m.setAssertions(List.of(
                Map.of("type", "json_path", "path", "$.status", "operator", "equals", "value", "degraded"),
                Map.of("type", "response_time", "value", 60000)));
        monitors.save(m);

        Check check = healthChecks.performCheck(reload(m));
        assertThat(check.getIsSuccess()).isFalse();
        assertThat(check.getErrorMessage()).isEqualTo("Assertions failed: json_path: expected degraded, got healthy");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> result = ArgumentCaptor.forClass(Map.class);
        verify(realtime).emitCheckResult(any(), result.capture());
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> results = (List<Map<String, Object>>) result.getValue().get("assertionResults");
        assertThat(results).hasSize(2);
        assertThat(results.get(1)).containsEntry("passed", true);
        assertThat((String) results.get(1).get("actual")).endsWith("ms");
    }

    @Test
    void timeoutAndConnectionErrorsUseNodeMessages() throws Exception {
        Monitor slow = fixtures.monitor(org.organizationId(), url());
        slow.setTimeoutMs(1000);
        monitors.save(slow);
        delayMs.set(2500);
        assertThat(healthChecks.performCheck(reload(slow)).getErrorMessage()).isEqualTo("Timeout after 1000ms");
        delayMs.set(0);

        int closedPort;
        try (ServerSocket s = new ServerSocket(0)) {
            closedPort = s.getLocalPort();
        }
        String refusedUrl = "http://127.0.0.1:" + closedPort + "/";
        Monitor refused = fixtures.monitor(org.organizationId(), refusedUrl);
        assertThat(healthChecks.performCheck(refused).getErrorMessage()).isEqualTo("Connection refused by " + refusedUrl);

        Monitor dns = fixtures.monitor(org.organizationId(), "http://no-such-host.invalid/");
        assertThat(healthChecks.performCheck(dns).getErrorMessage())
                .isEqualTo("DNS lookup failed for http://no-such-host.invalid/");
    }

    @Test
    void maintenanceSkipsChecksUntilTheWindowEnds() {
        Monitor m = fixtures.monitor(org.organizationId(), url());
        m.setMaintenanceMode(true);
        m.setMaintenanceEndAt(Instant.now().plusSeconds(3600));
        monitors.save(m);
        assertThat(healthChecks.performCheck(reload(m))).isNull();
        verify(realtime, never()).emitCheckResult(any(), anyMap());

        Monitor expired = reload(m);
        expired.setMaintenanceEndAt(Instant.now().minusSeconds(1));
        monitors.save(expired);
        assertThat(healthChecks.performCheck(reload(m))).isNotNull();
        assertThat(reload(m).inMaintenance()).isFalse();
        assertThat(reload(m).getMaintenanceEndAt()).isNull();
    }

    @Test
    void monitorPausedDuringACheckStaysPaused() {
        Monitor m = fixtures.monitor(org.organizationId(), url());
        Monitor snapshot = reload(m);
        Monitor paused = reload(m);
        paused.setStatus("paused");
        monitors.save(paused);

        assertThat(healthChecks.performCheck(snapshot)).isNotNull();
        assertThat(reload(m).getStatus()).isEqualTo("paused");
    }

    @Test
    void checkAllMonitorsOnlyRunsDueActiveHttpMonitors() {
        Monitor due = fixtures.monitor(org.organizationId(), url());
        Monitor notDue = fixtures.monitor(org.organizationId(), url());
        notDue.setLastCheckedAt(Instant.now());
        monitors.save(notDue);
        Monitor paused = fixtures.monitor(org.organizationId(), url());
        paused.setStatus("paused");
        monitors.save(paused);

        healthChecks.checkAllMonitors();

        assertThat(reload(due).getLastCheckedAt()).isNotNull();
        assertThat(reload(due).getStatus()).isEqualTo("up");
        assertThat(reload(notDue).getStatus()).isEqualTo("pending");
        assertThat(reload(paused).getStatus()).isEqualTo("paused");
    }

    @Test
    void deletedMonitorIsSkippedGracefully() {
        Monitor ghost = fixtures.monitor(org.organizationId(), url());
        monitors.deleteById(ghost.getId());
        assertThat(healthChecks.performCheck(ghost)).isNull();
        assertThat(monitors.findById(UUID.randomUUID())).isEmpty();
    }
}
