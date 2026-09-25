package com.uptimemonitor.auth;

import com.uptimemonitor.common.RequestValidator;
import com.uptimemonitor.security.AuthUser;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/** Sessions and password under /api/auth, plus the /api/security/events feed. */
@RestController
public class AccountController {

    private final AccountService account;

    public AccountController(AccountService account) {
        this.account = account;
    }

    @GetMapping("/api/auth/sessions")
    Map<String, Object> sessions(@AuthenticationPrincipal AuthUser user) {
        return Map.of("sessions", account.activeSessions(user));
    }

    @DeleteMapping("/api/auth/sessions/{id}")
    Map<String, Object> revokeSession(@AuthenticationPrincipal AuthUser user, @PathVariable String id,
                                      HttpServletRequest request) {
        account.revokeSession(user, RequestValidator.uuidParam("id", id), request);
        return Map.of("message", "Session revoked");
    }

    @PostMapping("/api/auth/logout-all-devices")
    Map<String, Object> logoutAll(@AuthenticationPrincipal AuthUser user, HttpServletRequest request) {
        int revoked = account.logoutAllDevices(user, request);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "All sessions revoked");
        body.put("revoked", revoked);
        return body;
    }

    @PostMapping("/api/auth/password")
    Map<String, Object> changePassword(@AuthenticationPrincipal AuthUser user,
                                       @RequestBody(required = false) Map<String, Object> body,
                                       HttpServletRequest request) {
        RequestValidator v = RequestValidator.of(body);
        String current = v.nonEmptyString("currentPassword");
        String next = v.string("newPassword", 8, 200, false, null);
        v.validate();
        account.changePassword(user, current, next, request);
        return Map.of("message", "Password changed. Other active sessions were signed out.");
    }

    @GetMapping("/api/security/events")
    Map<String, Object> events(@AuthenticationPrincipal AuthUser user, @RequestParam(required = false) String limit) {
        return Map.of("events", account.securityEvents(user, limit));
    }
}
