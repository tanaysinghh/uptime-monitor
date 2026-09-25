package com.uptimemonitor.security;

import com.uptimemonitor.domain.User;

import java.util.UUID;

/** The authenticated principal (req.user + req.currentSessionId in the Node server). */
public record AuthUser(UUID id, String email, String name, String role, UUID organizationId, UUID sessionId) {

    public static AuthUser of(User user, UUID sessionId) {
        return new AuthUser(user.getId(), user.getEmail(), user.getName(), user.getRole(),
                user.getOrganizationId(), sessionId);
    }

    public boolean isAdmin() {
        return "admin".equals(role);
    }
}
