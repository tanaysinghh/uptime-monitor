package com.uptimemonitor.realtime;

import com.uptimemonitor.support.ApiTestBase;
import io.socket.client.IO;
import io.socket.client.Socket;
import io.socket.engineio.client.transports.Polling;
import io.socket.engineio.client.transports.WebSocket;
import org.json.JSONObject;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.net.ServerSocket;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * Real Socket.IO v4 clients (the Java port of socket.io-client, protocol EIO=4 - the same
 * wire protocol the React app's socket.io-client@4 speaks) against the netty-socketio
 * server: room joins, event names and payload shape, over both transports.
 */
class SocketIoGatewayTest extends ApiTestBase {

    static final int PORT = freePort();

    @DynamicPropertySource
    static void socketProperties(DynamicPropertyRegistry registry) {
        registry.add("app.socket.enabled", () -> "true");
        registry.add("app.socket.port", () -> PORT);
    }

    @Autowired
    SocketIoGateway gateway;

    @Autowired
    RealtimeEvents realtime;

    private final List<Socket> sockets = new ArrayList<>();

    @AfterEach
    void disconnect() {
        sockets.forEach(Socket::disconnect);
    }

    private static int freePort() {
        try (ServerSocket s = new ServerSocket(0)) {
            return s.getLocalPort();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private Socket connect(String transport, String event, BlockingQueue<JSONObject> received) {
        IO.Options options = IO.Options.builder()
                .setTransports(new String[]{transport})
                .setForceNew(true)
                .setReconnection(false)
                .build();
        Socket socket = IO.socket(java.net.URI.create("http://localhost:" + PORT), options);
        socket.on(event, args -> received.add((JSONObject) args[0]));
        socket.connect();
        sockets.add(socket);
        await().atMost(10, TimeUnit.SECONDS).until(socket::connected);
        return socket;
    }

    @Test
    void realtimeBeanIsTheSocketIoGatewayWhenEnabled() {
        assertThat(realtime).isSameAs(gateway);
    }

    @Test
    void dashboardClientsReceiveMonitorUpdatesForTheirOrganizationOnly() throws Exception {
        UUID org = UUID.randomUUID();
        UUID otherOrg = UUID.randomUUID();
        BlockingQueue<JSONObject> mine = new LinkedBlockingQueue<>();
        BlockingQueue<JSONObject> theirs = new LinkedBlockingQueue<>();
        connect(WebSocket.NAME, "monitor:update", mine).emit("join:dashboard", org.toString());
        connect(WebSocket.NAME, "monitor:update", theirs).emit("join:dashboard", otherOrg.toString());
        await().atMost(5, TimeUnit.SECONDS).until(() -> gateway.clientsInRoom("org:" + org) == 1
                && gateway.clientsInRoom("org:" + otherOrg) == 1);

        Map<String, Object> data = new LinkedHashMap<>();
        UUID monitorId = UUID.randomUUID();
        data.put("monitorId", monitorId);
        data.put("name", "API");
        data.put("previousStatus", "up");
        data.put("currentStatus", "down");
        realtime.emitMonitorUpdate(org, data);

        JSONObject event = mine.poll(5, TimeUnit.SECONDS);
        assertThat(event).isNotNull();
        assertThat(event.getString("monitorId")).isEqualTo(monitorId.toString());
        assertThat(event.getString("name")).isEqualTo("API");
        assertThat(event.getString("previousStatus")).isEqualTo("up");
        assertThat(event.getString("currentStatus")).isEqualTo("down");
        assertThat(theirs.poll(500, TimeUnit.MILLISECONDS)).isNull();
    }

    @Test
    void incidentUpdatesReachDashboardAndStatusPageRoomsOverPolling() throws Exception {
        UUID org = UUID.randomUUID();
        String slug = "acme-" + UUID.randomUUID().toString().substring(0, 6);
        BlockingQueue<JSONObject> dashboard = new LinkedBlockingQueue<>();
        BlockingQueue<JSONObject> statusPage = new LinkedBlockingQueue<>();
        connect(Polling.NAME, "incident:update", dashboard).emit("join:dashboard", org.toString());
        connect(WebSocket.NAME, "incident:update", statusPage).emit("join:status", slug);
        await().atMost(5, TimeUnit.SECONDS).until(() -> gateway.clientsInRoom("org:" + org) == 1
                && gateway.clientsInRoom("status:" + slug) == 1);

        Instant startedAt = Instant.parse("2026-01-02T03:04:05.678Z");
        realtime.emitIncidentUpdate(org, slug, Map.of(
                "type", "new",
                "monitorName", "API",
                "incident", Map.of("status", "investigating", "startedAt", startedAt)));

        for (BlockingQueue<JSONObject> q : List.of(dashboard, statusPage)) {
            JSONObject event = q.poll(5, TimeUnit.SECONDS);
            assertThat(event).isNotNull();
            assertThat(event.getString("type")).isEqualTo("new");
            assertThat(event.getString("monitorName")).isEqualTo("API");
            // Timestamps are serialized exactly like the REST API (Date#toISOString format).
            assertThat(event.getJSONObject("incident").getString("startedAt")).isEqualTo("2026-01-02T03:04:05.678Z");
        }
    }

    @Test
    void checkResultsAreDelivered() throws Exception {
        UUID org = UUID.randomUUID();
        BlockingQueue<JSONObject> received = new LinkedBlockingQueue<>();
        connect(WebSocket.NAME, "check:result", received).emit("join:dashboard", org.toString());
        await().atMost(5, TimeUnit.SECONDS).until(() -> gateway.clientsInRoom("org:" + org) == 1);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("isSuccess", true);
        result.put("statusCode", 200);
        result.put("sslInfo", null);
        realtime.emitCheckResult(org, result);

        JSONObject event = received.poll(5, TimeUnit.SECONDS);
        assertThat(event).isNotNull();
        assertThat(event.getBoolean("isSuccess")).isTrue();
        assertThat(event.getInt("statusCode")).isEqualTo(200);
        // Null values are sent as null, not omitted (netty-socketio omits them by default).
        assertThat(event.has("sslInfo")).isTrue();
        assertThat(event.isNull("sslInfo")).isTrue();
    }
}
