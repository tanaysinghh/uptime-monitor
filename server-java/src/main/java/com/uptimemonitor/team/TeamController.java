package com.uptimemonitor.team;

import com.uptimemonitor.common.RequestValidator;
import com.uptimemonitor.security.AuthUser;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/team")
public class TeamController {

    private final TeamService team;

    public TeamController(TeamService team) {
        this.team = team;
    }

    @GetMapping("/members")
    Map<String, Object> members(@AuthenticationPrincipal AuthUser user) {
        return Map.of("members", team.members(user));
    }

    @PostMapping("/members")
    ResponseEntity<Map<String, Object>> invite(@AuthenticationPrincipal AuthUser user,
                                               @RequestBody(required = false) Map<String, Object> body,
                                               HttpServletRequest request) {
        RequestValidator v = RequestValidator.of(body);
        String email = v.email("email", null);
        String name = v.string("name", 1, 100, true, null);
        String password = v.string("password", 8, 200, false, null);
        String role = v.in("role", RequestValidator.ROLES, true);
        v.validate();
        return ResponseEntity.status(201)
                .body(Map.of("member", team.invite(user, email, name, password, role, request)));
    }

    @PutMapping("/members/{id}/role")
    Map<String, Object> updateRole(@AuthenticationPrincipal AuthUser user, @PathVariable String id,
                                   @RequestBody(required = false) Map<String, Object> body,
                                   HttpServletRequest request) {
        RequestValidator v = RequestValidator.of(body);
        var memberId = v.pathUuid("id", id);
        String role = v.in("role", RequestValidator.ROLES, false);
        v.validate();
        return Map.of("member", team.updateRole(user, memberId, role, request));
    }

    @DeleteMapping("/members/{id}")
    Map<String, Object> remove(@AuthenticationPrincipal AuthUser user, @PathVariable String id,
                               HttpServletRequest request) {
        team.remove(user, RequestValidator.uuidParam("id", id), request);
        return Map.of("message", "Member removed");
    }

    @GetMapping("/audit-log")
    Map<String, Object> auditLog(@AuthenticationPrincipal AuthUser user) {
        return Map.of("logs", team.auditLog(user));
    }
}
