package com.uptimemonitor.security;

import com.uptimemonitor.domain.Session;
import com.uptimemonitor.domain.User;
import com.uptimemonitor.repository.SessionRepository;
import com.uptimemonitor.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

/**
 * Port of middlewares/auth.js. Authenticates a Bearer access token, then re-checks the
 * database on every request: the user must exist, the session (sid) must not be revoked,
 * and the token must post-date the last password change.
 *
 * <p>Failures don't reject the request here; the reason is stashed on the request and
 * {@link JsonAuthEntryPoint} emits it only if the route requires authentication, which
 * preserves Node's per-route {@code authenticate} semantics.
 */
public class JwtAuthFilter extends OncePerRequestFilter {

    public static final String AUTH_ERROR_ATTRIBUTE = "auth.error";

    private final JwtService jwtService;
    private final UserRepository users;
    private final SessionRepository sessions;

    public JwtAuthFilter(JwtService jwtService, UserRepository users, SessionRepository sessions) {
        this.jwtService = jwtService;
        this.users = users;
        this.sessions = sessions;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String[] parts = header.split(" ");
            String token = parts.length > 1 ? parts[1] : "";
            String error = authenticate(token, request);
            if (error != null) {
                request.setAttribute(AUTH_ERROR_ATTRIBUTE, error);
            }
        }
        chain.doFilter(request, response);
    }

    private String authenticate(String token, HttpServletRequest request) {
        Optional<JwtService.AccessClaims> verified = jwtService.verifyAccessToken(token);
        if (verified.isEmpty()) {
            return "Invalid token";
        }
        JwtService.AccessClaims claims = verified.get();
        try {
            Optional<User> found = users.findById(claims.userId());
            if (found.isEmpty()) {
                return "User not found";
            }
            User user = found.get();

            if (claims.sessionId() != null) {
                Optional<Session> session = sessions.findById(claims.sessionId());
                if (session.isEmpty() || session.get().getRevokedAt() != null) {
                    return "Session revoked";
                }
            }

            if (user.getPasswordChangedAt() != null && claims.issuedAtSeconds() > 0
                    && user.getPasswordChangedAt().getEpochSecond() > claims.issuedAtSeconds()) {
                return "Token invalidated by password change";
            }

            AuthUser principal = AuthUser.of(user, claims.sessionId());
            var authentication = new UsernamePasswordAuthenticationToken(principal, null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole())));
            SecurityContextHolder.getContext().setAuthentication(authentication);
            return null;
        } catch (RuntimeException e) {
            return "Invalid token";
        }
    }
}
