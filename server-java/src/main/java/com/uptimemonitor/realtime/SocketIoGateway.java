package com.uptimemonitor.realtime;

import com.corundumstudio.socketio.Configuration;
import com.corundumstudio.socketio.SocketConfig;
import com.corundumstudio.socketio.SocketIOServer;
import com.corundumstudio.socketio.Transport;
import com.uptimemonitor.common.Json;
import com.uptimemonitor.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * Socket.IO v4 server (netty-socketio) replacing socketService.js, so the React client's
 * existing socket.io-client keeps working unchanged: same events ("join:dashboard",
 * "join:status" in; "monitor:update", "incident:update", "check:result" out) and rooms.
 *
 * <p>netty-socketio runs its own Netty listener, so it binds a separate port
 * (SOCKET_PORT, default 5001) next to the HTTP API. It is started after and stopped
 * before the rest of the context, so shutdown closes client connections first.
 *
 * <p>As in the Node server, joining a room is unauthenticated: the socket.io client sends
 * no credentials. Payloads carry only monitor/incident status, never secrets.
 */
@Component
@ConditionalOnProperty(prefix = "app.socket", name = "enabled", havingValue = "true", matchIfMissing = true)
public class SocketIoGateway implements RealtimeEvents, SmartLifecycle {

    private static final Logger log = LoggerFactory.getLogger(SocketIoGateway.class);

    private final SocketIOServer server;
    private final Json json;
    private final int port;
    private volatile boolean running;

    public SocketIoGateway(AppProperties props, Json json) {
        this.json = json;
        this.port = props.socket().port();

        Configuration config = new Configuration();
        config.setPort(port);
        config.setOrigin(props.clientUrl());
        config.setTransports(Transport.WEBSOCKET, Transport.POLLING);
        config.setPingInterval(25_000);
        config.setPingTimeout(20_000);
        config.setJsonSupport(new NullPreservingJsonSupport());
        SocketConfig socketConfig = new SocketConfig();
        socketConfig.setReuseAddress(true);
        config.setSocketConfig(socketConfig);

        this.server = new SocketIOServer(config);
        server.addConnectListener(client -> log.debug("Client connected: {}", client.getSessionId()));
        server.addDisconnectListener(client -> log.debug("Client disconnected: {}", client.getSessionId()));
        server.addEventListener("join:dashboard", Object.class,
                (client, orgId, ack) -> client.joinRoom(orgRoom(String.valueOf(orgId))));
        server.addEventListener("join:status", Object.class,
                (client, slug, ack) -> client.joinRoom(statusRoom(String.valueOf(slug))));
    }

    static String orgRoom(String organizationId) {
        return "org:" + organizationId;
    }

    static String statusRoom(String slug) {
        return "status:" + slug;
    }

    // ---- RealtimeEvents ---------------------------------------------------------------

    @Override
    public void emitMonitorUpdate(UUID organizationId, Map<String, Object> data) {
        emit(orgRoom(organizationId.toString()), MONITOR_UPDATE, data);
    }

    @Override
    public void emitIncidentUpdate(UUID organizationId, String slug, Map<String, Object> data) {
        emit(orgRoom(organizationId.toString()), INCIDENT_UPDATE, data);
        if (slug != null) {
            emit(statusRoom(slug), INCIDENT_UPDATE, data);
        }
    }

    @Override
    public void emitCheckResult(UUID organizationId, Map<String, Object> data) {
        emit(orgRoom(organizationId.toString()), CHECK_RESULT, data);
    }

    private void emit(String room, String event, Map<String, Object> data) {
        if (!running) {
            return;
        }
        try {
            // Normalize through the app's JSON settings (ISO timestamps, UUID strings):
            // netty-socketio serializes with its own ObjectMapper.
            server.getRoomOperations(room).sendEvent(event, json.toMap(data));
        } catch (RuntimeException e) {
            log.warn("Failed to emit {} to {}: {}", event, room, e.getMessage());
        }
    }

    /** Number of clients currently in a room (diagnostics and tests). */
    public int clientsInRoom(String room) {
        return server.getRoomOperations(room).getClients().size();
    }

    public int port() {
        return port;
    }

    // ---- lifecycle -------------------------------------------------------------------

    @Override
    public void start() {
        server.start();
        running = true;
        log.info("Socket.IO server listening on port {}", port);
    }

    @Override
    public void stop() {
        running = false;
        server.stop();
        log.info("Socket.IO server stopped");
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    /** Start late / stop early relative to the web server and other lifecycle beans. */
    @Override
    public int getPhase() {
        return Integer.MAX_VALUE - 1000;
    }
}
