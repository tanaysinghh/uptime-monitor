package com.uptimemonitor.auth;

import com.uptimemonitor.common.RequestValidator;
import com.uptimemonitor.ratelimit.Limiter;
import com.uptimemonitor.ratelimit.RateLimited;
import com.uptimemonitor.security.AuthUser;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** /api/auth - registration, login, MFA challenge, token refresh and the current user. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/register")
    @RateLimited(Limiter.REGISTER)
    ResponseEntity<Map<String, Object>> register(@RequestBody(required = false) Map<String, Object> body,
                                                 HttpServletRequest request) {
        RequestValidator v = RequestValidator.of(body);
        String email = v.email("email", "Valid email required");
        String password = v.string("password", 8, 200, false, "Password must be 8-200 chars");
        String name = v.string("name", 1, 100, true, "Name required");
        String orgName = v.string("orgName", 1, 100, true, "Organization name required");
        v.validate();
        return ResponseEntity.status(201).body(auth.register(email, password, name, orgName, request));
    }

    @PostMapping("/login")
    @RateLimited(Limiter.LOGIN)
    Map<String, Object> login(@RequestBody(required = false) Map<String, Object> body, HttpServletRequest request) {
        RequestValidator v = RequestValidator.of(body);
        String email = v.email("email", null);
        String password = v.nonEmptyString("password");
        v.validate();
        return auth.login(email, password, request);
    }

    @PostMapping("/mfa/challenge")
    @RateLimited(Limiter.MFA)
    Map<String, Object> mfaChallenge(@RequestBody(required = false) Map<String, Object> body,
                                     HttpServletRequest request) {
        RequestValidator v = RequestValidator.of(body);
        String token = v.nonEmptyString("mfaChallengeToken");
        String code = v.string("code", 6, 20, false, null);
        v.validate();
        return auth.completeMfaChallenge(token, code, request);
    }

    @PostMapping("/refresh-token")
    @RateLimited(Limiter.AUTH)
    Map<String, Object> refreshToken(@RequestBody(required = false) Map<String, Object> body,
                                     HttpServletRequest request) {
        RequestValidator v = RequestValidator.of(body);
        String refreshToken = v.nonEmptyString("refreshToken");
        v.validate();
        return auth.refresh(refreshToken, request);
    }

    @GetMapping("/me")
    Map<String, Object> me(@AuthenticationPrincipal AuthUser user) {
        return Map.of("user", auth.me(user));
    }
}
