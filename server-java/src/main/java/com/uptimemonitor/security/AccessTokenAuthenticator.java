package com.uptimemonitor.security;

import com.uptimemonitor.domain.Session;
import com.uptimemonitor.domain.User;
import com.uptimemonitor.repository.SessionRepository;
import com.uptimemonitor.repository.UserRepository;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * The checks behind a Bearer access token (middlewares/auth.js), shared by the HTTP
 * filter and the STOMP CONNECT handler: signature and type, the user still exists, the
 * session (sid) is not revoked, and the token post-dates the last password change.
 */
@Component
public class AccessTokenAuthenticator {

    /** Either a principal or the reason the token was refused. */
    public record Result(AuthUser user, String error) {
        static Result ok(AuthUser user) {
            return new Result(user, null);
        }

        static Result fail(String error) {
            return new Result(null, error);
        }

        public boolean ok() {
            return user != null;
        }
    }

    private final JwtService jwtService;
    private final UserRepository users;
    private final SessionRepository sessions;

    public AccessTokenAuthenticator(JwtService jwtService, UserRepository users, SessionRepository sessions) {
        this.jwtService = jwtService;
        this.users = users;
        this.sessions = sessions;
    }

    public Result authenticate(String token) {
        Optional<JwtService.AccessClaims> verified = jwtService.verifyAccessToken(token);
        if (verified.isEmpty()) {
            return Result.fail("Invalid token");
        }
        JwtService.AccessClaims claims = verified.get();
        try {
            Optional<User> found = users.findById(claims.userId());
            if (found.isEmpty()) {
                return Result.fail("User not found");
            }
            User user = found.get();

            if (claims.sessionId() != null) {
                Optional<Session> session = sessions.findById(claims.sessionId());
                if (session.isEmpty() || session.get().getRevokedAt() != null) {
                    return Result.fail("Session revoked");
                }
            }

            if (user.getPasswordChangedAt() != null && claims.issuedAtSeconds() > 0
                    && user.getPasswordChangedAt().getEpochSecond() > claims.issuedAtSeconds()) {
                return Result.fail("Token invalidated by password change");
            }
            return Result.ok(AuthUser.of(user, claims.sessionId()));
        } catch (RuntimeException e) {
            return Result.fail("Invalid token");
        }
    }

    /** The token from an "Authorization: Bearer ..." value, or null. */
    public static String bearerToken(String header) {
        if (header == null || !header.startsWith("Bearer ")) {
            return null;
        }
        String[] parts = header.split(" ");
        return parts.length > 1 ? parts[1] : "";
    }
}
