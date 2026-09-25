package com.uptimemonitor.monitor;

import com.uptimemonitor.common.RequestValidator;
import com.uptimemonitor.common.Times;
import com.uptimemonitor.domain.Monitor;
import com.uptimemonitor.repository.MonitorRepository;
import com.uptimemonitor.security.AuthUser;
import com.uptimemonitor.security.RequireEditor;
import com.uptimemonitor.team.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Port of controllers/maintenanceController.js: checks pause during a maintenance window. */
@RestController
@RequestMapping("/api/maintenance")
@RequireEditor
public class MaintenanceController {

    private final MonitorService monitorService;
    private final MonitorRepository monitors;
    private final AuditLogService audit;

    public MaintenanceController(MonitorService monitorService, MonitorRepository monitors, AuditLogService audit) {
        this.monitorService = monitorService;
        this.monitors = monitors;
        this.audit = audit;
    }

    @PostMapping("/monitors/{id}/enable")
    Map<String, Object> enable(@AuthenticationPrincipal AuthUser user, @PathVariable String id,
                               @RequestBody(required = false) Map<String, Object> body, HttpServletRequest request) {
        RequestValidator v = RequestValidator.of(body);
        UUID monitorId = v.pathUuid("id", id);
        String reason = v.optionalString("reason", 0, 500, false, null);
        Instant startAt = v.optionalIso8601("startAt", false);
        Instant endAt = v.optionalIso8601("endAt", false);
        v.validate();

        Monitor m = monitorService.get(user.organizationId(), monitorId);
        m.setMaintenanceMode(true);
        m.setMaintenanceReason(reason != null && !reason.isEmpty() ? reason : "Scheduled maintenance");
        m.setMaintenanceStartAt(startAt != null ? startAt : Times.now());
        m.setMaintenanceEndAt(endAt);
        monitors.save(m);

        // Node logged { reason, startAt, endAt } as sent; absent keys were dropped by JSON.
        Map<String, Object> details = new LinkedHashMap<>();
        for (String key : new String[]{"reason", "startAt", "endAt"}) {
            if (v.has(key)) {
                details.put(key, v.raw(key));
            }
        }
        audit.record(user, "enable_maintenance", "monitor", m.getId(), details, request);
        return Map.of("monitor", m);
    }

    @PostMapping("/monitors/{id}/disable")
    Map<String, Object> disable(@AuthenticationPrincipal AuthUser user, @PathVariable String id,
                                HttpServletRequest request) {
        Monitor m = monitorService.get(user.organizationId(), RequestValidator.uuidParam("id", id));
        m.setMaintenanceMode(false);
        m.setMaintenanceReason(null);
        m.setMaintenanceStartAt(null);
        m.setMaintenanceEndAt(null);
        monitors.save(m);
        audit.record(user, "disable_maintenance", "monitor", m.getId(), Map.of(), request);
        return Map.of("monitor", m);
    }
}
