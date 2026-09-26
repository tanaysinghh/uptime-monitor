package com.uptimemonitor.realtime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.messaging.MessageHeaders;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;
import org.springframework.util.MimeTypeUtils;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;
import java.util.UUID;

/**
 * Publishes the Socket.IO events of services/socketService.js as STOMP messages: the
 * event name goes in an {@code event} header and the body is the same JSON, written with
 * the application's mapper (ISO-8601 timestamps, nulls kept, as in the REST API).
 */
@Component
@ConditionalOnProperty(prefix = "app.realtime", name = "enabled", havingValue = "true", matchIfMissing = true)
public class StompGateway implements RealtimeEvents {

    private static final Logger log = LoggerFactory.getLogger(StompGateway.class);

    private final SimpMessagingTemplate template;
    private final JsonMapper mapper;

    public StompGateway(SimpMessagingTemplate template, JsonMapper mapper) {
        this.template = template;
        this.mapper = mapper;
    }

    public static String orgDestination(UUID organizationId) {
        return StompConfig.ORG_TOPIC + organizationId;
    }

    public static String statusDestination(String slug) {
        return StompConfig.STATUS_TOPIC + slug;
    }

    @Override
    public void emitMonitorUpdate(UUID organizationId, Map<String, Object> data) {
        emit(orgDestination(organizationId), MONITOR_UPDATE, data);
    }

    @Override
    public void emitIncidentUpdate(UUID organizationId, String slug, Map<String, Object> data) {
        emit(orgDestination(organizationId), INCIDENT_UPDATE, data);
        if (slug != null) {
            emit(statusDestination(slug), INCIDENT_UPDATE, data);
        }
    }

    @Override
    public void emitCheckResult(UUID organizationId, Map<String, Object> data) {
        emit(orgDestination(organizationId), CHECK_RESULT, data);
    }

    private void emit(String destination, String event, Map<String, Object> data) {
        try {
            byte[] body = mapper.writeValueAsBytes(data);
            // Extra headers become STOMP native headers; the frame's content-type comes from
            // the message header, which the byte[] converter sets to octet-stream.
            template.convertAndSend(destination, body, Map.of("event", event), message ->
                    MessageBuilder.fromMessage(message)
                            .setHeader(MessageHeaders.CONTENT_TYPE, MimeTypeUtils.APPLICATION_JSON)
                            .build());
        } catch (RuntimeException e) {
            // A push failure must never break the check or request that triggered it.
            log.warn("Failed to publish {} to {}: {}", event, destination, e.getMessage());
        }
    }
}
