package com.uptimemonitor.monitor;

import com.uptimemonitor.common.RequestValidator;
import com.uptimemonitor.security.AuthUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final StatsService stats;

    public StatsController(StatsService stats) {
        this.stats = stats;
    }

    @GetMapping("/dashboard")
    Map<String, Object> dashboard(@AuthenticationPrincipal AuthUser user) {
        return stats.dashboard(user.organizationId());
    }

    @GetMapping("/monitors/{id}")
    Map<String, Object> monitor(@AuthenticationPrincipal AuthUser user, @PathVariable String id,
                                @RequestParam(required = false) String period) {
        UUID monitorId = RequestValidator.isUuid(id) ? UUID.fromString(id) : null;
        return stats.monitorStats(user.organizationId(), monitorId, period);
    }
}
