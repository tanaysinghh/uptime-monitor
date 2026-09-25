package com.uptimemonitor.auth;

import com.uptimemonitor.common.Crypto;
import com.uptimemonitor.common.Http;
import com.uptimemonitor.common.Times;
import com.uptimemonitor.domain.Session;
import com.uptimemonitor.domain.User;
import com.uptimemonitor.repository.SessionRepository;
import com.uptimemonitor.security.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * Revocable server-side sessions (services/sessionService.js). Each login creates a
 * Session row; the refresh token embeds its id (sid) and only its SHA-256 is stored.
 * Refresh rotates the token, so a replayed old refresh token no longer matches.
 */
@Service
public class SessionService {

    public record Tokens(String accessToken, String refreshToken, Session session) {
    }

    private final SessionRepository sessions;
    private final JwtService jwt;

    public SessionService(SessionRepository sessions, JwtService jwt) {
        this.sessions = sessions;
        this.jwt = jwt;
    }

    public Tokens issueSession(User user, HttpServletRequest request) {
        Instant now = Times.now();
        Session session = new Session();
        session.setUserId(user.getId());
        session.setUserAgent(request == null ? null : Http.userAgent(request));
        session.setIpAddress(request == null ? null : truncate(Http.clientIp(request), 45));
        session.setLastUsedAt(now);
        session.setExpiresAt(now.plus(jwt.refreshTtl()));

        String refreshToken = jwt.generateRefreshToken(user.getId(), session.getId());
        session.setRefreshTokenHash(Crypto.sha256Hex(refreshToken));
        sessions.save(session);

        String accessToken = jwt.generateAccessToken(user.getId(), session.getId());
        return new Tokens(accessToken, refreshToken, session);
    }

    public Tokens rotateSession(Session session, User user, HttpServletRequest request) {
        String refreshToken = jwt.generateRefreshToken(user.getId(), session.getId());
        session.setRefreshTokenHash(Crypto.sha256Hex(refreshToken));
        session.setLastUsedAt(Times.now());
        if (request != null) {
            session.setIpAddress(truncate(Http.clientIp(request), 45));
            session.setUserAgent(Http.userAgent(request));
        }
        sessions.save(session);
        String accessToken = jwt.generateAccessToken(user.getId(), session.getId());
        return new Tokens(accessToken, refreshToken, session);
    }

    public void revokeSession(Session session) {
        session.setRevokedAt(Times.now());
        session.setRefreshTokenHash("revoked-" + session.getId());
        sessions.save(session);
    }

    /** Revokes every active session of the user, optionally keeping the current one. */
    public int revokeAllForUser(UUID userId, UUID exceptSessionId) {
        Instant now = Times.now();
        return exceptSessionId == null
                ? sessions.revokeAllForUser(userId, now)
                : sessions.revokeAllForUserExcept(userId, exceptSessionId, now);
    }

    public Optional<Session> findActiveSession(UUID sessionId, String refreshToken) {
        if (sessionId == null) {
            return Optional.empty();
        }
        return sessions.findById(sessionId)
                .filter(s -> s.getRevokedAt() == null)
                .filter(s -> !s.getExpiresAt().isBefore(Instant.now()))
                .filter(s -> Crypto.constantTimeEquals(s.getRefreshTokenHash(), Crypto.sha256Hex(refreshToken)));
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
