package com.uptimemonitor.team;

import com.uptimemonitor.common.ApiException;
import com.uptimemonitor.common.Json;
import com.uptimemonitor.domain.AuditLog;
import com.uptimemonitor.domain.User;
import com.uptimemonitor.repository.AuditLogRepository;
import com.uptimemonitor.repository.UserRepository;
import com.uptimemonitor.security.AuthUser;
import com.uptimemonitor.security.PasswordPolicy;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Port of controllers/teamController.js. As in Node, write operations check for the admin
 * role inside the handler (after request validation), with handler-specific messages.
 */
@Service
public class TeamService {

    private final UserRepository users;
    private final AuditLogRepository auditLogs;
    private final AuditLogService audit;
    private final PasswordEncoder passwordEncoder;
    private final PasswordPolicy passwordPolicy;
    private final Json json;

    public TeamService(UserRepository users, AuditLogRepository auditLogs, AuditLogService audit,
                       PasswordEncoder passwordEncoder, PasswordPolicy passwordPolicy, Json json) {
        this.users = users;
        this.auditLogs = auditLogs;
        this.audit = audit;
        this.passwordEncoder = passwordEncoder;
        this.passwordPolicy = passwordPolicy;
        this.json = json;
    }

    /**
     * Same allowlist as the Node server's MEMBER_ATTRIBUTES: no credentials, MFA secrets or
     * lockout state, including for columns added later.
     */
    public List<Map<String, Object>> members(AuthUser actor) {
        return users.findByOrganizationIdOrderByCreatedAtAsc(actor.organizationId()).stream().map(u -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", u.getId());
            m.put("email", u.getEmail());
            m.put("name", u.getName());
            m.put("role", u.getRole());
            m.put("isVerified", u.getIsVerified());
            m.put("organizationId", u.getOrganizationId());
            m.put("mfaEnabled", u.isMfaEnabled());
            m.put("createdAt", u.getCreatedAt());
            m.put("updatedAt", u.getUpdatedAt());
            return m;
        }).toList();
    }

    public Map<String, Object> invite(AuthUser actor, String email, String name, String password, String role,
                                      HttpServletRequest request) {
        requireAdmin(actor, "Only admins can invite members");
        PasswordPolicy.Result pw = passwordPolicy.evaluate(password, List.of(email, name));
        if (!pw.ok()) {
            throw new ApiException(400, pw.reason(), Map.of("passwordScore", pw.score()));
        }
        if (users.findByEmail(email).isPresent()) {
            throw ApiException.badRequest("Email already registered");
        }
        String effectiveRole = role != null ? role : "viewer";
        User user = new User();
        user.setEmail(email);
        user.setName(name);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(effectiveRole);
        user.setOrganizationId(actor.organizationId());
        user.setIsVerified(true);
        users.save(user);

        audit.record(actor, "invite_member", "user", user.getId(), details("email", email, "role", effectiveRole), request);

        Map<String, Object> member = new LinkedHashMap<>();
        member.put("id", user.getId());
        member.put("email", user.getEmail());
        member.put("name", user.getName());
        member.put("role", user.getRole());
        member.put("createdAt", user.getCreatedAt());
        return member;
    }

    public Map<String, Object> updateRole(AuthUser actor, UUID memberId, String role, HttpServletRequest request) {
        requireAdmin(actor, "Only admins can change roles");
        User member = member(actor, memberId);
        if (member.getId().equals(actor.id())) {
            throw ApiException.badRequest("Cannot change your own role");
        }
        String oldRole = member.getRole();
        member.setRole(role);
        users.save(member);
        audit.record(actor, "update_role", "user", member.getId(), details("oldRole", oldRole, "newRole", role), request);

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", member.getId());
        m.put("email", member.getEmail());
        m.put("name", member.getName());
        m.put("role", member.getRole());
        return m;
    }

    public void remove(AuthUser actor, UUID memberId, HttpServletRequest request) {
        requireAdmin(actor, "Only admins can remove members");
        User member = member(actor, memberId);
        if (member.getId().equals(actor.id())) {
            throw ApiException.badRequest("Cannot remove yourself");
        }
        audit.record(actor, "remove_member", "user", member.getId(),
                details("email", member.getEmail(), "name", member.getName()), request);
        users.delete(member);
    }

    /** Latest 100 org audit entries with the acting user embedded as "User": {name, email}. */
    public List<Map<String, Object>> auditLog(AuthUser actor) {
        List<AuditLog> logs = auditLogs.findTop100ByOrganizationIdOrderByCreatedAtDesc(actor.organizationId());
        Map<UUID, User> actors = users.findByIdIn(logs.stream().map(AuditLog::getUserId).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        return logs.stream().map(log -> {
            User u = actors.get(log.getUserId());
            return json.withAssociation(log, "User", u == null ? null : Map.of("name", u.getName(), "email", u.getEmail()));
        }).toList();
    }

    private User member(AuthUser actor, UUID memberId) {
        return users.findByIdAndOrganizationId(memberId, actor.organizationId())
                .orElseThrow(() -> ApiException.notFound("Member not found"));
    }

    private static void requireAdmin(AuthUser actor, String message) {
        if (!actor.isAdmin()) {
            throw ApiException.forbidden(message);
        }
    }

    private static Map<String, Object> details(String k1, Object v1, String k2, Object v2) {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put(k1, v1);
        d.put(k2, v2);
        return d;
    }
}
