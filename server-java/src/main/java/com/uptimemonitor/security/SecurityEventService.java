package com.uptimemonitor.security;

import com.uptimemonitor.common.Http;
import com.uptimemonitor.domain.SecurityEvent;
import com.uptimemonitor.repository.SecurityEventRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Map;
import java.util.UUID;

/**
 * Append-only security audit trail (utils/securityEvents.js). Recording never fails the
 * caller: each event is written in its own transaction and errors are only logged.
 */
@Service
public class SecurityEventService {

    private static final Logger log = LoggerFactory.getLogger(SecurityEventService.class);

    private final SecurityEventRepository events;
    private final TransactionTemplate newTx;

    public SecurityEventService(SecurityEventRepository events, PlatformTransactionManager txManager) {
        this.events = events;
        this.newTx = new TransactionTemplate(txManager);
        this.newTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void record(UUID userId, UUID organizationId, String eventType, HttpServletRequest request) {
        record(userId, organizationId, eventType, request, Map.of());
    }

    public void record(UUID userId, UUID organizationId, String eventType, HttpServletRequest request,
                       Map<String, Object> metadata) {
        try {
            SecurityEvent event = new SecurityEvent();
            event.setUserId(userId);
            event.setOrganizationId(organizationId);
            event.setEventType(eventType);
            event.setIpAddress(truncate(Http.clientIp(request), 45));
            event.setUserAgent(Http.userAgent(request));
            event.setMetadata(metadata == null ? Map.of() : metadata);
            newTx.executeWithoutResult(status -> events.save(event));
        } catch (RuntimeException e) {
            log.error("failed to record security event {} for user {}: {}", eventType, userId, e.getMessage());
        }
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
