package com.uptimemonitor.monitor;

import com.uptimemonitor.common.ApiException;
import com.uptimemonitor.common.RequestValidator;
import com.uptimemonitor.domain.Check;
import com.uptimemonitor.domain.Incident;
import com.uptimemonitor.domain.Monitor;
import com.uptimemonitor.repository.CheckRepository;
import com.uptimemonitor.repository.IncidentRepository;
import com.uptimemonitor.repository.MonitorRepository;
import com.uptimemonitor.security.SsrfGuard;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Port of controllers/monitorController.js. Every query is scoped to the caller's org. */
@Service
public class MonitorService {

    private final MonitorRepository monitors;
    private final CheckRepository checks;
    private final IncidentRepository incidents;
    private final SsrfGuard ssrfGuard;

    public MonitorService(MonitorRepository monitors, CheckRepository checks, IncidentRepository incidents,
                          SsrfGuard ssrfGuard) {
        this.monitors = monitors;
        this.checks = checks;
        this.incidents = incidents;
        this.ssrfGuard = ssrfGuard;
    }

    public List<Monitor> list(UUID organizationId) {
        return monitors.findByOrganizationIdOrderByCreatedAtDesc(organizationId);
    }

    public Monitor get(UUID organizationId, UUID id) {
        return monitors.findByIdAndOrganizationId(id, organizationId)
                .orElseThrow(() -> ApiException.notFound("Monitor not found"));
    }

    public Monitor create(UUID organizationId, Map<String, Object> body) {
        RequestValidator v = RequestValidator.of(body);
        String name = v.string("name", 1, 200, true, null);
        String url = v.string("url", 0, 2048, false, null);
        String method = v.in("method", RequestValidator.MONITOR_METHODS, true);
        Integer interval = v.optionalInt("intervalSeconds", 30, 86400);
        Integer timeout = v.optionalInt("timeoutMs", 1000, 60000);
        Integer expected = v.optionalInt("expectedStatus", 100, 599);
        Map<String, Object> headers = v.object("headers", true);
        List<?> tags = v.optionalArray("tags");
        v.validate();

        requireSafeUrl(url);

        Monitor m = new Monitor();
        m.setName(name);
        m.setUrl(url);
        m.setMethod(method != null ? method : "GET");
        m.setHeaders(headers != null ? headers : new LinkedHashMap<>());
        m.setBody(truthy(body.get("body")) ? body.get("body") : null);
        m.setIntervalSeconds(interval != null && interval != 0 ? interval : 300);
        m.setTimeoutMs(timeout != null && timeout != 0 ? timeout : 30000);
        m.setExpectedStatus(expected != null && expected != 0 ? expected : 200);
        m.setTags(tags != null ? toStrings(tags) : new ArrayList<>());
        m.setOrganizationId(organizationId);
        return monitors.save(m);
    }

    @SuppressWarnings("unchecked")
    public Monitor update(UUID organizationId, String idParam, Map<String, Object> body) {
        RequestValidator v = RequestValidator.of(body);
        UUID id = v.pathUuid("id", idParam);
        String name = v.optionalString("name", 1, 200, true, null);
        if (v.has("url")) {
            v.string("url", 0, 2048, false, null);
        }
        String method = v.in("method", RequestValidator.MONITOR_METHODS, true);
        Integer interval = v.optionalInt("intervalSeconds", 30, 86400);
        Integer timeout = v.optionalInt("timeoutMs", 1000, 60000);
        Integer expected = v.optionalInt("expectedStatus", 100, 599);
        String status = v.in("status", RequestValidator.MONITOR_STATUSES, true);
        if (v.has("headers") && v.raw("headers") != null) {
            v.object("headers", false);
        }
        if (v.has("tags") && v.raw("tags") != null) {
            v.optionalArray("tags");
        }
        v.validate();

        Monitor m = get(organizationId, id);

        if (v.has("url") && !v.raw("url").equals(m.getUrl())) {
            requireSafeUrl((String) v.raw("url"));
        }

        if (v.has("name")) m.setName(name);
        if (v.has("url")) m.setUrl((String) v.raw("url"));
        if (v.has("method")) m.setMethod(method);
        if (v.has("headers")) m.setHeaders((Map<String, Object>) v.raw("headers"));
        if (v.has("body")) m.setBody(v.raw("body"));
        if (v.has("intervalSeconds")) m.setIntervalSeconds(interval);
        if (v.has("timeoutMs")) m.setTimeoutMs(timeout);
        if (v.has("expectedStatus")) m.setExpectedStatus(expected);
        if (v.has("status")) m.setStatus(status);
        if (v.has("tags")) m.setTags(v.raw("tags") == null ? null : toStrings((List<?>) v.raw("tags")));
        return monitors.save(m);
    }

    @Transactional
    public void delete(UUID organizationId, UUID id) {
        Monitor m = get(organizationId, id);
        checks.deleteByMonitorId(m.getId());
        incidents.deleteByMonitorId(m.getId());
        monitors.delete(m);
    }

    /**
     * Checks for a period. Unlike the Node controller (which only filtered by monitorId,
     * letting any user read any org's checks by UUID) the monitor must belong to the
     * caller's organization; otherwise the list is empty, same as for an unknown id.
     */
    public List<Check> checks(UUID organizationId, UUID monitorId, String period) {
        if (!monitors.existsByIdAndOrganizationId(monitorId, organizationId)) {
            return List.of();
        }
        Instant since = Instant.now().minus(periodDuration(period));
        return checks.findByMonitorIdAndCheckedAtGreaterThanEqualOrderByCheckedAtAsc(monitorId, since);
    }

    public List<Incident> incidents(UUID organizationId, UUID monitorId) {
        if (!monitors.existsByIdAndOrganizationId(monitorId, organizationId)) {
            return List.of();
        }
        return incidents.findByMonitorIdOrderByStartedAtDesc(monitorId, Limit.of(20));
    }

    static Duration periodDuration(String period) {
        return switch (period == null ? "" : period) {
            case "7d" -> Duration.ofDays(7);
            case "30d" -> Duration.ofDays(30);
            case "90d" -> Duration.ofDays(90);
            default -> Duration.ofHours(24);
        };
    }

    private void requireSafeUrl(String url) {
        SsrfGuard.Result result = ssrfGuard.validateMonitorUrl(url);
        if (!result.ok()) {
            throw ApiException.badRequest(result.reason());
        }
    }

    private static List<String> toStrings(List<?> values) {
        List<String> out = new ArrayList<>(values.size());
        for (Object o : values) {
            out.add(String.valueOf(o));
        }
        return out;
    }

    /** JavaScript truthiness, for the {@code x || default} idioms in the Node code. */
    static boolean truthy(Object v) {
        if (v == null) return false;
        if (v instanceof Boolean b) return b;
        if (v instanceof Number n) return n.doubleValue() != 0 && !Double.isNaN(n.doubleValue());
        if (v instanceof String s) return !s.isEmpty();
        return true;
    }
}
