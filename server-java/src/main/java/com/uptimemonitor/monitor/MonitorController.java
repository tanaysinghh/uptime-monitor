package com.uptimemonitor.monitor;

import com.uptimemonitor.common.RequestValidator;
import com.uptimemonitor.security.AuthUser;
import com.uptimemonitor.security.RequireEditor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** /api/monitors - reads for every role, writes for admin/editor. */
@RestController
@RequestMapping("/api/monitors")
public class MonitorController {

    private final MonitorService monitors;

    public MonitorController(MonitorService monitors) {
        this.monitors = monitors;
    }

    @GetMapping
    Map<String, Object> list(@AuthenticationPrincipal AuthUser user) {
        return Map.of("monitors", monitors.list(user.organizationId()));
    }

    @GetMapping("/{id}")
    Map<String, Object> get(@AuthenticationPrincipal AuthUser user, @PathVariable String id) {
        return Map.of("monitor", monitors.get(user.organizationId(), RequestValidator.uuidParam("id", id)));
    }

    @GetMapping("/{id}/checks")
    Map<String, Object> checks(@AuthenticationPrincipal AuthUser user, @PathVariable String id,
                               @RequestParam(required = false) String period) {
        return Map.of("checks", monitors.checks(user.organizationId(), RequestValidator.uuidParam("id", id), period));
    }

    @GetMapping("/{id}/incidents")
    Map<String, Object> incidents(@AuthenticationPrincipal AuthUser user, @PathVariable String id) {
        return Map.of("incidents", monitors.incidents(user.organizationId(), RequestValidator.uuidParam("id", id)));
    }

    @PostMapping
    @RequireEditor
    ResponseEntity<Map<String, Object>> create(@AuthenticationPrincipal AuthUser user,
                                               @RequestBody(required = false) Map<String, Object> body) {
        return ResponseEntity.status(201)
                .body(Map.of("monitor", monitors.create(user.organizationId(), body == null ? Map.of() : body)));
    }

    @PutMapping("/{id}")
    @RequireEditor
    Map<String, Object> update(@AuthenticationPrincipal AuthUser user, @PathVariable String id,
                               @RequestBody(required = false) Map<String, Object> body) {
        return Map.of("monitor", monitors.update(user.organizationId(), id, body == null ? Map.of() : body));
    }

    @DeleteMapping("/{id}")
    @RequireEditor
    Map<String, Object> delete(@AuthenticationPrincipal AuthUser user, @PathVariable String id) {
        monitors.delete(user.organizationId(), RequestValidator.uuidParam("id", id));
        return Map.of("message", "Monitor deleted");
    }
}
