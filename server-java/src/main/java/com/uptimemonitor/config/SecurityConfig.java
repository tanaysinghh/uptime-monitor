package com.uptimemonitor.config;

import com.uptimemonitor.repository.SessionRepository;
import com.uptimemonitor.repository.UserRepository;
import com.uptimemonitor.security.BcryptJsPasswordEncoder;
import com.uptimemonitor.security.JsonAuthEntryPoint;
import com.uptimemonitor.security.JwtAuthFilter;
import com.uptimemonitor.security.JwtService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Stateless JWT security. Which routes require a token mirrors where the Node routers
 * applied {@code authenticate} (router-wide for monitors/stats/alerts/team/...; per-route
 * for auth, heartbeat and public). Everything else is open so unknown paths fall through
 * to the {"error":"Not found"} handler, as in Express. Role checks use method security
 * ({@code @RequireAdmin}/{@code @RequireEditor}).
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    static final String[] AUTHENTICATED = {
            "/api/auth/me",
            "/api/auth/sessions/**",
            "/api/auth/logout-all-devices",
            "/api/auth/password",
            "/api/auth/mfa/setup",
            "/api/auth/mfa/verify",
            "/api/auth/mfa/disable",
            "/api/auth/mfa/backup-codes/regenerate",
            "/api/monitors/**",
            "/api/stats/**",
            "/api/alerts/**",
            "/api/team/**",
            "/api/api-keys/**",
            "/api/security/**",
            "/api/maintenance/**",
            "/api/public/subscribers",
    };

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JwtService jwtService, UserRepository users,
                                            SessionRepository sessions, JsonAuthEntryPoint entryPoint)
            throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> {
                })
                .headers(headers -> headers.disable()) // helmet-equivalent headers: SecurityHeadersFilter
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .logout(logout -> logout.disable())
                .requestCache(cache -> cache.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(e -> e.authenticationEntryPoint(entryPoint))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/heartbeat/monitors").authenticated()
                        .requestMatchers(AUTHENTICATED).authenticated()
                        .anyRequest().permitAll())
                .addFilterBefore(new JwtAuthFilter(jwtService, users, sessions),
                        UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /** cors({ origin: CLIENT_URL, credentials: true }) */
    @Bean
    CorsConfigurationSource corsConfigurationSource(AppProperties props) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(props.clientUrl()));
        config.setAllowedMethods(List.of("GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("X-Request-Id", "RateLimit", "RateLimit-Policy", "Retry-After"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BcryptJsPasswordEncoder(12);
    }
}
