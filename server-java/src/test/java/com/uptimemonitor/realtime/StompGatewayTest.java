package com.uptimemonitor.realtime;

import com.uptimemonitor.support.PostgresTestcontainer;
import com.uptimemonitor.support.TestApi;
import com.uptimemonitor.repository.SessionRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.messaging.converter.ByteArrayMessageConverter;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.lang.reflect.Type;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

/**
 * Real STOMP-over-WebSocket clients against the running application: authentication at
 * CONNECT, per-organization authorization at SUBSCRIBE, no client publishing, the event
 * header and JSON payload shape, heartbeats, and resubscription after a reconnect.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(PostgresTestcontainer.class)
class StompGatewayTest {

    static final String ORIGIN = "http://localhost:5173"; // app.client-url in application-test.yml

    @LocalServerPort
    int port;

    @Autowired
    MockMvc mvc;

    @Autowired
    JsonMapper mapper;

    @Autowired
    RealtimeEvents realtime;

    @Autowired
    SessionRepository sessions;

    TestApi api;
    WebSocketStompClient stomp;
    ThreadPoolTaskScheduler heartbeatScheduler;
    final List<StompSession> opened = new ArrayList<>();

    record Received(String event, String contentType, JsonNode body) {
    }

    /** Session-level handler: records ERROR frames and transport failures. */
    static class Recorder extends StompSessionHandlerAdapter {
        final BlockingQueue<String> errors = new LinkedBlockingQueue<>();

        @Override
        public Type getPayloadType(StompHeaders headers) {
            return byte[].class;
        }

        @Override
        public void handleFrame(StompHeaders headers, Object payload) {
            errors.add(String.valueOf(headers.getFirst("message")));
        }

        @Override
        public void handleTransportError(StompSession session, Throwable exception) {
            errors.add("transport: " + exception.getClass().getSimpleName());
        }

        @Override
        public void handleException(StompSession session, StompCommand command, StompHeaders headers,
                                    byte[] payload, Throwable exception) {
            errors.add("client exception: " + exception);
        }
    }

    @BeforeEach
    void setUp() {
        api = new TestApi(mvc, mapper);
        stomp = new WebSocketStompClient(new StandardWebSocketClient());
        // Frames are application/json; hand the raw bytes to the test either way.
        stomp.setMessageConverter(new ByteArrayMessageConverter() {
            @Override
            protected boolean supportsMimeType(org.springframework.messaging.MessageHeaders headers) {
                return true;
            }
        });
        heartbeatScheduler = new ThreadPoolTaskScheduler();
        heartbeatScheduler.initialize();
        stomp.setTaskScheduler(heartbeatScheduler);
        stomp.setDefaultHeartbeat(new long[]{10_000, 10_000});
    }

    @AfterEach
    void tearDown() {
        for (StompSession session : opened) {
            try {
                session.disconnect();
            } catch (RuntimeException alreadyClosing) {
                // the server closes the connection after an ERROR frame
            }
        }
        stomp.stop();
        heartbeatScheduler.shutdown();
    }

    private StompSession connect(String token, Recorder recorder) throws Exception {
        return connect(token, recorder, ORIGIN);
    }

    private StompSession connect(String token, Recorder recorder, String origin) throws Exception {
        WebSocketHttpHeaders http = new WebSocketHttpHeaders();
        http.setOrigin(origin);
        StompHeaders connect = new StompHeaders();
        if (token != null) {
            connect.add("Authorization", "Bearer " + token);
        }
        StompSession session = stomp.connectAsync(URI.create("ws://localhost:" + port + StompConfig.ENDPOINT),
                http, connect, recorder).get(10, TimeUnit.SECONDS);
        opened.add(session);
        return session;
    }

    private BlockingQueue<Received> subscribe(StompSession session, String destination) {
        BlockingQueue<Received> queue = new LinkedBlockingQueue<>();
        session.subscribe(destination, new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return byte[].class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                queue.add(new Received(headers.getFirst("event"), String.valueOf(headers.getContentType()),
                        mapper.readTree(new String((byte[]) payload, StandardCharsets.UTF_8))));
            }
        });
        return queue;
    }

    /** SUBSCRIBE has no reply frame; a round trip through the broker proves it is active. */
    private void awaitSubscribed(UUID org, BlockingQueue<Received> queue) throws Exception {
        await().atMost(5, TimeUnit.SECONDS).pollInterval(100, TimeUnit.MILLISECONDS).until(() -> {
            realtime.emitCheckResult(org, Map.of("probe", true));
            return queue.poll(100, TimeUnit.MILLISECONDS) != null;
        });
        queue.clear();
    }

    private static Map<String, Object> monitorUpdate(UUID monitorId) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("monitorId", monitorId);
        data.put("name", "API");
        data.put("previousStatus", "up");
        data.put("currentStatus", "down");
        return data;
    }

    @Test
    void realtimeBeanIsTheStompGateway() {
        assertThat(realtime).isInstanceOf(StompGateway.class);
    }

    @Test
    void membersReceiveTheirOrganizationsEventsWithTheSocketIoEventNameAndJsonBody() throws Exception {
        TestApi.Registered user = api.register();
        UUID org = UUID.fromString(user.organizationId());
        StompSession session = connect(user.accessToken(), new Recorder());
        BlockingQueue<Received> queue = subscribe(session, StompGateway.orgDestination(org));
        awaitSubscribed(org, queue);

        UUID monitorId = UUID.randomUUID();
        realtime.emitMonitorUpdate(org, monitorUpdate(monitorId));
        Received update = queue.poll(5, TimeUnit.SECONDS);
        assertThat(update).isNotNull();
        assertThat(update.event()).isEqualTo("monitor:update");
        assertThat(update.contentType()).isEqualTo("application/json");
        assertThat(update.body().get("monitorId").asString()).isEqualTo(monitorId.toString());
        assertThat(update.body().get("currentStatus").asString()).isEqualTo("down");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("monitorId", monitorId);
        result.put("isSuccess", true);
        result.put("statusCode", 200);
        result.put("sslInfo", null);
        result.put("checkedAt", Instant.parse("2026-01-02T03:04:05.678Z"));
        realtime.emitCheckResult(org, result);
        Received check = queue.poll(5, TimeUnit.SECONDS);
        assertThat(check.event()).isEqualTo("check:result");
        // Same JSON as the REST API: nulls kept, Date#toISOString timestamps.
        assertThat(check.body().has("sslInfo")).isTrue();
        assertThat(check.body().get("sslInfo").isNull()).isTrue();
        assertThat(check.body().get("checkedAt").asString()).isEqualTo("2026-01-02T03:04:05.678Z");
    }

    @Test
    void eventsForOneOrganizationNeverReachAnother() throws Exception {
        TestApi.Registered a = api.register();
        TestApi.Registered b = api.register();
        UUID orgA = UUID.fromString(a.organizationId());
        UUID orgB = UUID.fromString(b.organizationId());
        BlockingQueue<Received> qa = subscribe(connect(a.accessToken(), new Recorder()), StompGateway.orgDestination(orgA));
        BlockingQueue<Received> qb = subscribe(connect(b.accessToken(), new Recorder()), StompGateway.orgDestination(orgB));
        awaitSubscribed(orgA, qa);
        awaitSubscribed(orgB, qb);

        realtime.emitMonitorUpdate(orgA, monitorUpdate(UUID.randomUUID()));
        assertThat(qa.poll(5, TimeUnit.SECONDS)).isNotNull();
        assertThat(qb.poll(500, TimeUnit.MILLISECONDS)).isNull();
    }

    @Test
    void subscribingToAnotherOrganizationIsRefusedAndTheConnectionClosed() throws Exception {
        TestApi.Registered mine = api.register();
        TestApi.Registered other = api.register();
        Recorder recorder = new Recorder();
        StompSession session = connect(mine.accessToken(), recorder);
        subscribe(session, StompGateway.orgDestination(UUID.fromString(other.organizationId())));
        assertThat(recorder.errors.poll(5, TimeUnit.SECONDS)).isEqualTo("Forbidden: not a member of this organization");
        await().atMost(5, TimeUnit.SECONDS).until(() -> !session.isConnected());
    }

    @Test
    void anonymousConnectionsCanFollowAStatusPageButNotAnOrganization() throws Exception {
        TestApi.Registered user = api.register();
        UUID org = UUID.fromString(user.organizationId());
        String slug = "acme-" + UUID.randomUUID().toString().substring(0, 6);

        BlockingQueue<Received> status = subscribe(connect(null, new Recorder()), StompGateway.statusDestination(slug));
        await().atMost(5, TimeUnit.SECONDS).pollInterval(100, TimeUnit.MILLISECONDS).until(() -> {
            realtime.emitIncidentUpdate(org, slug, Map.of("type", "probe"));
            return status.poll(100, TimeUnit.MILLISECONDS) != null;
        });
        status.clear();
        realtime.emitIncidentUpdate(org, slug, Map.of("type", "new", "monitorName", "API",
                "incident", Map.of("status", "investigating")));
        Received incident = status.poll(5, TimeUnit.SECONDS);
        assertThat(incident.event()).isEqualTo("incident:update");
        assertThat(incident.body().get("monitorName").asString()).isEqualTo("API");

        Recorder recorder = new Recorder();
        subscribe(connect(null, recorder), StompGateway.orgDestination(org));
        assertThat(recorder.errors.poll(5, TimeUnit.SECONDS))
                .isEqualTo("Unauthorized: organization updates need a signed-in user");
    }

    @Test
    void invalidTokensAreRefusedAtConnect() throws Exception {
        for (String token : List.of("not-a-jwt", api.register().accessToken() + "x")) {
            Recorder recorder = new Recorder();
            try {
                connect(token, recorder);
            } catch (ExecutionException expected) {
                // the server may close before CONNECTED is processed
            }
            assertThat(recorder.errors.poll(5, TimeUnit.SECONDS)).isEqualTo("Unauthorized: Invalid token");
        }
    }

    @Test
    void aSessionRevokedAfterConnectCannotSubscribe() throws Exception {
        TestApi.Registered user = api.register();
        Recorder recorder = new Recorder();
        StompSession session = connect(user.accessToken(), recorder);
        // Revoke the token's session (what "sign out this device" does) after CONNECT.
        var revoked = sessions.findAll().stream()
                .filter(s -> s.getUserId().toString().equals(user.userId()))
                .peek(s -> s.setRevokedAt(Instant.now()))
                .toList();
        assertThat(revoked).hasSize(1);
        sessions.saveAll(revoked);
        subscribe(session, StompGateway.orgDestination(UUID.fromString(user.organizationId())));
        assertThat(recorder.errors.poll(5, TimeUnit.SECONDS)).isEqualTo("Unauthorized: Session revoked");
    }

    @Test
    void clientsCannotPublishIntoTheBroker() throws Exception {
        TestApi.Registered attacker = api.register();
        TestApi.Registered victim = api.register();
        UUID victimOrg = UUID.fromString(victim.organizationId());
        BlockingQueue<Received> victimQueue = subscribe(connect(victim.accessToken(), new Recorder()),
                StompGateway.orgDestination(victimOrg));
        awaitSubscribed(victimOrg, victimQueue);

        Recorder recorder = new Recorder();
        StompSession session = connect(attacker.accessToken(), recorder);
        StompHeaders headers = new StompHeaders();
        headers.setDestination(StompGateway.orgDestination(victimOrg));
        headers.add("event", "incident:update");
        session.send(headers, "{\"type\":\"new\",\"monitorName\":\"spoofed\"}".getBytes(StandardCharsets.UTF_8));

        assertThat(recorder.errors.poll(5, TimeUnit.SECONDS)).isEqualTo("Clients cannot publish");
        assertThat(victimQueue.poll(500, TimeUnit.MILLISECONDS)).isNull();
    }

    @Test
    void unknownDestinationsAreRefused() throws Exception {
        Recorder recorder = new Recorder();
        subscribe(connect(api.register().accessToken(), recorder), "/topic/org/../status/x");
        assertThat(recorder.errors.poll(5, TimeUnit.SECONDS)).isEqualTo("Forbidden: unknown destination");
    }

    @Test
    void handshakeFromAnotherOriginIsRejected() {
        assertThatThrownBy(() -> connect(null, new Recorder(), "https://evil.example"))
                .isInstanceOf(ExecutionException.class);
    }

    @Test
    void serverNegotiatesHeartbeats() throws Exception {
        StompSession session = connect(null, new Recorder());
        assertThat(session.isConnected()).isTrue();
        // DefaultStompSession applies the CONNECTED frame's heart-beat header; the server
        // advertised 10s/10s, so the client schedules its own heartbeat task.
        assertThat(heartbeatScheduler.getScheduledThreadPoolExecutor().getQueue()).isNotEmpty();
    }

    @Test
    void aReconnectingClientResubscribesAndReceivesEventsAgain() throws Exception {
        TestApi.Registered user = api.register();
        UUID org = UUID.fromString(user.organizationId());
        StompSession first = connect(user.accessToken(), new Recorder());
        BlockingQueue<Received> q1 = subscribe(first, StompGateway.orgDestination(org));
        awaitSubscribed(org, q1);
        first.disconnect();
        await().atMost(5, TimeUnit.SECONDS).until(() -> !first.isConnected());

        StompSession second = connect(user.accessToken(), new Recorder());
        BlockingQueue<Received> q2 = subscribe(second, StompGateway.orgDestination(org));
        awaitSubscribed(org, q2);
        realtime.emitMonitorUpdate(org, monitorUpdate(UUID.randomUUID()));
        assertThat(q2.poll(5, TimeUnit.SECONDS)).isNotNull();
        assertThat(q1.poll(300, TimeUnit.MILLISECONDS)).isNull();
    }

    @Test
    void anEventBurstArrivesCompleteAndInOrder() throws Exception {
        TestApi.Registered user = api.register();
        UUID org = UUID.fromString(user.organizationId());
        BlockingQueue<Received> queue = subscribe(connect(user.accessToken(), new Recorder()),
                StompGateway.orgDestination(org));
        awaitSubscribed(org, queue);
        for (int i = 0; i < 200; i++) {
            realtime.emitCheckResult(org, Map.of("seq", i));
        }
        for (int i = 0; i < 200; i++) {
            Received r = queue.poll(5, TimeUnit.SECONDS);
            assertThat(r).as("event %d", i).isNotNull();
            assertThat(r.body().get("seq").asInt()).isEqualTo(i);
        }
    }

    @Test
    void scheduledJobsStillRunOnBootsTaskScheduler(@Autowired org.springframework.context.ApplicationContext context) {
        assertThat(context.getBean("taskScheduler"))
                .isInstanceOf(org.springframework.scheduling.concurrent.SimpleAsyncTaskScheduler.class);
    }

    @Test
    void mfaChallengeTokensAreNotAccessTokens(@Autowired com.uptimemonitor.security.JwtService jwt) throws Exception {
        TestApi.Registered user = api.register();
        String challenge = jwt.generateMfaChallengeToken(UUID.fromString(user.userId()), UUID.randomUUID());
        Recorder recorder = new Recorder();
        try {
            connect(challenge, recorder);
        } catch (ExecutionException expected) {
            // the server may close before CONNECTED is processed
        }
        assertThat(recorder.errors.poll(5, TimeUnit.SECONDS)).isEqualTo("Unauthorized: Invalid token");
    }
}
