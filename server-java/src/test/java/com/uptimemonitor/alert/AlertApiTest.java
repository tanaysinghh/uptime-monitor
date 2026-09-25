package com.uptimemonitor.alert;

import com.sun.net.httpserver.HttpServer;
import com.uptimemonitor.domain.AlertLog;
import com.uptimemonitor.domain.Monitor;
import com.uptimemonitor.repository.AlertLogRepository;
import com.uptimemonitor.support.ApiTestBase;
import com.uptimemonitor.support.Fixtures;
import com.uptimemonitor.support.TestApi;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import tools.jackson.databind.JsonNode;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/** Alert channel CRUD, test sends against a local receiver, and the delivery log. */
@TestPropertySource(properties = "app.allow-private-urls=true")
class AlertApiTest extends ApiTestBase {

    @Autowired
    Fixtures fixtures;
    @Autowired
    AlertLogRepository alertLogs;

    private TestApi.Registered admin;
    private HttpServer receiver;
    private final AtomicReference<String> received = new AtomicReference<>();

    @BeforeEach
    void setUp() throws Exception {
        admin = api.register();
        receiver = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        receiver.createContext("/ok", ex -> {
            received.set(new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            ex.sendResponseHeaders(204, -1);
            ex.close();
        });
        receiver.createContext("/fail", ex -> {
            ex.sendResponseHeaders(500, -1);
            ex.close();
        });
        receiver.start();
    }

    @AfterEach
    void tearDown() {
        receiver.stop(0);
    }

    private String url(String path) {
        return "http://127.0.0.1:" + receiver.getAddress().getPort() + path;
    }

    private String createChannel(String type, Map<String, Object> config) throws Exception {
        TestApi.Response r = api.post("/api/alerts/channels",
                Map.of("name", type + " channel", "type", type, "config", config), admin.accessToken());
        assertThat(r.status()).isEqualTo(201);
        return r.body().get("channel").get("id").asString();
    }

    @Test
    void createListUpdateDelete() throws Exception {
        TestApi.Response created = api.post("/api/alerts/channels", Map.of("name", " Ops ", "type", "webhook",
                "config", Map.of("url", url("/ok")), "cooldownMinutes", 0), admin.accessToken());
        JsonNode channel = created.body().get("channel");
        assertThat(channel.get("name").asString()).isEqualTo("Ops");
        assertThat(channel.get("cooldownMinutes").asInt()).isEqualTo(5); // `cooldownMinutes || 5`
        assertThat(channel.get("isActive").asBoolean()).isTrue();
        String id = channel.get("id").asString();

        assertThat(api.get("/api/alerts/channels", admin.accessToken()).body().get("channels").size()).isEqualTo(1);

        TestApi.Response updated = api.put("/api/alerts/channels/" + id, Map.of("isActive", false, "cooldownMinutes", 30),
                admin.accessToken());
        assertThat(updated.body().get("channel").get("isActive").asBoolean()).isFalse();
        assertThat(updated.body().get("channel").get("cooldownMinutes").asInt()).isEqualTo(30);
        assertThat(api.put("/api/alerts/channels/" + id, Map.of("type", "pager"), admin.accessToken()).status())
                .isEqualTo(400);

        assertThat(api.delete("/api/alerts/channels/" + id, admin.accessToken()).body().get("message").asString())
                .isEqualTo("Alert channel deleted");
        assertThat(api.delete("/api/alerts/channels/" + id, admin.accessToken()).error()).isEqualTo("Alert channel not found");
    }

    @Test
    void validationAndRbac() throws Exception {
        TestApi.Response bad = api.post("/api/alerts/channels", Map.of("name", "x", "type", "sms", "config", "nope"),
                admin.accessToken());
        assertThat(bad.body().get("details").findValuesAsString("field")).containsExactly("type", "config");

        String viewer = fixtures.memberToken(api, admin.organizationId(), "viewer");
        TestApi.Response denied = api.post("/api/alerts/channels",
                Map.of("name", "x", "type", "webhook", "config", Map.of()), viewer);
        assertThat(denied.error()).isEqualTo("Requires one of: admin, editor. You are viewer.");
        assertThat(api.get("/api/alerts/channels", viewer).status()).isEqualTo(200);
    }

    @Test
    void testSendDeliversToTheWebhookAndReportsFailures() throws Exception {
        String ok = createChannel("webhook", Map.of("url", url("/ok")));
        TestApi.Response sent = api.post("/api/alerts/channels/" + ok + "/test", null, admin.accessToken());
        assertThat(sent.status()).isEqualTo(200);
        assertThat(sent.body().get("message").asString()).isEqualTo("Test alert sent successfully");
        JsonNode payload = mapper.readTree(received.get());
        assertThat(payload.get("event").asString()).isEqualTo("test");
        assertThat(payload.get("message").asString()).isEqualTo("This is a test alert from UptimeMonitor");

        String failing = createChannel("slack", Map.of("webhookUrl", url("/fail")));
        TestApi.Response failed = api.post("/api/alerts/channels/" + failing + "/test", null, admin.accessToken());
        assertThat(failed.status()).isEqualTo(500);
        assertThat(failed.error()).isEqualTo("Test failed: Request failed with status code 500");

        String email = createChannel("email", Map.of("to", "ops@example.com"));
        assertThat(api.post("/api/alerts/channels/" + email + "/test", null, admin.accessToken()).status()).isEqualTo(200);
    }

    @Test
    void logsIncludeMonitorAndChannelAndAreOrgScoped() throws Exception {
        String channelId = createChannel("webhook", Map.of("url", url("/ok")));
        Monitor monitor = fixtures.monitor(admin.organizationId(), "https://93.184.216.34/");
        AlertLog log = new AlertLog();
        log.setMonitorId(monitor.getId());
        log.setChannelId(UUID.fromString(channelId));
        log.setType("down");
        log.setStatus("sent");
        alertLogs.save(log);

        JsonNode logs = api.get("/api/alerts/logs", admin.accessToken()).body().get("logs");
        assertThat(logs.size()).isEqualTo(1);
        assertThat(logs.get(0).get("Monitor").get("name").asString()).isEqualTo(monitor.getName());
        assertThat(logs.get(0).get("AlertChannel").get("type").asString()).isEqualTo("webhook");
        assertThat(api.get("/api/alerts/logs", api.register().accessToken()).body().get("logs").size()).isZero();

        // deleting the channel removes its log entries
        api.delete("/api/alerts/channels/" + channelId, admin.accessToken());
        assertThat(api.get("/api/alerts/logs", admin.accessToken()).body().get("logs").size()).isZero();
    }
}
