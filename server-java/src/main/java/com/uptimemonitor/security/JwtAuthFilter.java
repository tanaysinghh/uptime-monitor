package com.uptimemonitor.security;

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

/**
 * Port of middlewares/auth.js. Authenticates a Bearer access token, then re-checks the
 * database on every request (see {@link AccessTokenAuthenticator}).
 *
 * <p>Failures don't reject the request here; the reason is stashed on the request and
 * {@link JsonAuthEntryPoint} emits it only if the route requires authentication, which
 * preserves Node's per-route {@code authenticate} semantics.
 */
public class JwtAuthFilter extends OncePerRequestFilter {

    public static final String AUTH_ERROR_ATTRIBUTE = "auth.error";

    private final AccessTokenAuthenticator authenticator;

    public JwtAuthFilter(AccessTokenAuthenticator authenticator) {
        this.authenticator = authenticator;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = AccessTokenAuthenticator.bearerToken(request.getHeader("Authorization"));
        if (token != null) {
            AccessTokenAuthenticator.Result result = authenticator.authenticate(token);
            if (result.ok()) {
                AuthUser principal = result.user();
                var authentication = new UsernamePasswordAuthenticationToken(principal, null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + principal.role())));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } else {
                request.setAttribute(AUTH_ERROR_ATTRIBUTE, result.error());
            }
        }
        chain.doFilter(request, response);
    }
}
