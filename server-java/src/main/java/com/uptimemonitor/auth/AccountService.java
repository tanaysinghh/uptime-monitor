package com.uptimemonitor.auth;

import com.uptimemonitor.common.ApiException;
import com.uptimemonitor.common.Times;
import com.uptimemonitor.domain.SecurityEvent;
import com.uptimemonitor.domain.Session;
import com.uptimemonitor.domain.User;
import com.uptimemonitor.repository.SecurityEventRepository;
import com.uptimemonitor.repository.SessionRepository;
import com.uptimemonitor.repository.UserRepository;
import com.uptimemonitor.security.AuthUser;
import com.uptimemonitor.security.PasswordPolicy;
import com.uptimemonitor.security.SecurityEventService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Limit;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Session management, password change and the security event feed for the signed-in user. */
@Service
public class AccountService {

    private static final Pattern LEADING_INT = Pattern.compile("^\\s*([+-]?\\d+)");

    private final SessionRepository sessionRepository;
    private final SessionService sessionService;
    private final UserRepository users;
    private final SecurityEventRepository eventRepository;
    private final SecurityEventService securityEvents;
    private final PasswordEncoder passwordEncoder;
    private final PasswordPolicy passwordPolicy;

    public AccountService(SessionRepository sessionRepository, SessionService sessionService, UserRepository users,
                          SecurityEventRepository eventRepository, SecurityEventService securityEvents,
                          PasswordEncoder passwordEncoder, PasswordPolicy passwordPolicy) {
        this.sessionRepository = sessionRepository;
        this.sessionService = sessionService;
        this.users = users;
        this.eventRepository = eventRepository;
        this.securityEvents = securityEvents;
        this.passwordEncoder = passwordEncoder;
        this.passwordPolicy = passwordPolicy;
    }

    public List<Map<String, Object>> activeSessions(AuthUser principal) {
        return sessionRepository.findActiveByUser(principal.id()).stream().map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.getId());
            m.put("userAgent", s.getUserAgent());
            m.put("ipAddress", s.getIpAddress());
            m.put("createdAt", s.getCreatedAt());
            m.put("lastUsedAt", s.getLastUsedAt());
            m.put("expiresAt", s.getExpiresAt());
            m.put("current", Objects.equals(s.getId(), principal.sessionId()));
            return m;
        }).toList();
    }

    public void revokeSession(AuthUser principal, UUID sessionId, HttpServletRequest request) {
        Session session = sessionRepository.findByIdAndUserId(sessionId, principal.id())
                .filter(s -> s.getRevokedAt() == null)
                .orElseThrow(() -> ApiException.notFound("Session not found"));
        sessionService.revokeSession(session);
        securityEvents.record(principal.id(), principal.organizationId(), SecurityEvent.SESSION_REVOKED, request,
                Map.of("sessionId", session.getId().toString()));
    }

    /** Revokes every session including the current one, as the Node endpoint does. */
    public int logoutAllDevices(AuthUser principal, HttpServletRequest request) {
        int revoked = sessionService.revokeAllForUser(principal.id(), null);
        securityEvents.record(principal.id(), principal.organizationId(), SecurityEvent.SESSIONS_REVOKED_ALL, request,
                Map.of("revoked", revoked));
        return revoked;
    }

    public void changePassword(AuthUser principal, String currentPassword, String newPassword,
                               HttpServletRequest request) {
        User user = users.findById(principal.id()).orElseThrow(() -> ApiException.notFound("User not found"));
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw ApiException.unauthorized("Current password is incorrect");
        }
        PasswordPolicy.Result pw = passwordPolicy.evaluate(newPassword, List.of(user.getEmail(), user.getName()));
        if (!pw.ok()) {
            throw new ApiException(400, pw.reason(), Map.of("passwordScore", pw.score()));
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setPasswordChangedAt(Times.now());
        users.save(user);
        sessionService.revokeAllForUser(user.getId(), principal.sessionId());
        securityEvents.record(user.getId(), user.getOrganizationId(), SecurityEvent.PASSWORD_CHANGED, request);
    }

    public List<Map<String, Object>> securityEvents(AuthUser principal, String limitParam) {
        int limit = parseLimit(limitParam);
        return eventRepository.findByUserIdOrderByCreatedAtDesc(principal.id(), Limit.of(limit)).stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", e.getId());
            m.put("eventType", e.getEventType());
            m.put("ipAddress", e.getIpAddress());
            m.put("userAgent", e.getUserAgent());
            m.put("metadata", e.getMetadata());
            m.put("createdAt", e.getCreatedAt());
            return m;
        }).toList();
    }

    /** Math.min(parseInt(limit) || 50, 200), additionally floored at 1. */
    static int parseLimit(String limitParam) {
        int limit = 50;
        if (limitParam != null) {
            Matcher m = LEADING_INT.matcher(limitParam);
            if (m.find()) {
                try {
                    int parsed = Integer.parseInt(m.group(1));
                    limit = parsed == 0 ? 50 : parsed;
                } catch (NumberFormatException e) {
                    limit = 200;
                }
            }
        }
        return Math.max(1, Math.min(limit, 200));
    }
}
