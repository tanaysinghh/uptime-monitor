package com.uptimemonitor.monitor;

import com.uptimemonitor.common.ApiException;
import com.uptimemonitor.common.Json;
import com.uptimemonitor.domain.Incident;
import com.uptimemonitor.domain.Monitor;
import com.uptimemonitor.repository.IncidentRepository;
import com.uptimemonitor.repository.MonitorRepository;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Port of controllers/statsController.js. Aggregates run in SQL; p95/p99 use
 * percentile_disc, which is the same nearest-rank method as calculatePercentile() in Node
 * (index = ceil(p * n) - 1) without loading every response time into memory.
 */
@Service
public class StatsService {

    static final Map<String, Duration> PERIODS = Map.of(
            "24h", Duration.ofHours(24),
            "7d", Duration.ofDays(7),
            "30d", Duration.ofDays(30),
            "90d", Duration.ofDays(90));

    private static final String AGGREGATE_SQL = """
            SELECT COUNT(id) AS "totalChecks",
                   COALESCE(SUM(CASE WHEN "isSuccess" = true THEN 1 ELSE 0 END), 0) AS "successfulChecks",
                   AVG("responseTimeMs") AS "avgResponseTime",
                   MAX("responseTimeMs") AS "maxResponseTime",
                   MIN("responseTimeMs") AS "minResponseTime",
                   percentile_disc(0.95) WITHIN GROUP (ORDER BY "responseTimeMs") AS "p95",
                   percentile_disc(0.99) WITHIN GROUP (ORDER BY "responseTimeMs") AS "p99"
            FROM "Checks"
            WHERE "monitorId" IN (:ids) AND "checkedAt" >= :since
            """;

    private final MonitorRepository monitors;
    private final IncidentRepository incidents;
    private final NamedParameterJdbcTemplate jdbc;
    private final Json json;

    public StatsService(MonitorRepository monitors, IncidentRepository incidents, NamedParameterJdbcTemplate jdbc,
                        Json json) {
        this.monitors = monitors;
        this.incidents = incidents;
        this.jdbc = jdbc;
        this.json = json;
    }

    record Aggregate(long totalChecks, long successfulChecks, double avg, int max, int min, int p95, int p99) {
        double uptimePercentage() {
            return totalChecks > 0 ? round2(successfulChecks * 100.0 / totalChecks) : 100;
        }
    }

    Aggregate aggregate(Collection<UUID> monitorIds, Instant since) {
        if (monitorIds.isEmpty()) {
            return new Aggregate(0, 0, 0, 0, 0, 0, 0);
        }
        var params = new MapSqlParameterSource("ids", monitorIds).addValue("since", Timestamp.from(since));
        return jdbc.queryForObject(AGGREGATE_SQL, params, (rs, i) -> new Aggregate(
                rs.getLong("totalChecks"),
                rs.getLong("successfulChecks"),
                rs.getDouble("avgResponseTime"),
                rs.getInt("maxResponseTime"),
                rs.getInt("minResponseTime"),
                rs.getInt("p95"),
                rs.getInt("p99")));
    }

    public Map<String, Object> dashboard(UUID organizationId) {
        List<Monitor> all = monitors.findByOrganizationId(organizationId);
        List<UUID> ids = all.stream().map(Monitor::getId).toList();
        Aggregate agg = aggregate(ids, Instant.now().minus(Duration.ofHours(24)));

        Map<UUID, Monitor> byId = all.stream().collect(Collectors.toMap(Monitor::getId, Function.identity()));
        List<Map<String, Object>> active = ids.isEmpty() ? List.of()
                : incidents.findOpenByMonitorIds(ids).stream()
                .map(i -> withMonitor(i, byId.get(i.getMonitorId()), true))
                .toList();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("totalMonitors", all.size());
        body.put("monitorsUp", all.stream().filter(m -> "up".equals(m.getStatus())).count());
        body.put("monitorsDown", all.stream().filter(m -> "down".equals(m.getStatus())).count());
        body.put("monitorsPaused", all.stream().filter(m -> "paused".equals(m.getStatus())).count());
        body.put("monitorsInMaintenance", all.stream().filter(Monitor::inMaintenance).count());
        body.put("totalChecks", agg.totalChecks());
        body.put("uptimePercentage", agg.uptimePercentage());
        body.put("avgResponseTime", Math.round(agg.avg()));
        body.put("p95ResponseTime", agg.p95());
        body.put("p99ResponseTime", agg.p99());
        body.put("activeIncidents", active);
        return body;
    }

    public Map<String, Object> monitorStats(UUID organizationId, UUID monitorId, String periodParam) {
        Monitor monitor = monitorId == null ? null
                : monitors.findByIdAndOrganizationId(monitorId, organizationId).orElse(null);
        if (monitor == null) {
            throw ApiException.notFound("Monitor not found");
        }
        String period = periodParam == null || periodParam.isEmpty() ? "24h" : periodParam;
        Instant since = Instant.now().minus(PERIODS.getOrDefault(period, PERIODS.get("24h")));
        Aggregate agg = aggregate(List.of(monitor.getId()), since);
        List<Incident> inPeriod =
                incidents.findByMonitorIdAndStartedAtGreaterThanEqualOrderByStartedAtDesc(monitor.getId(), since);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("monitor", monitor);
        body.put("period", period);
        body.put("totalChecks", agg.totalChecks());
        body.put("uptimePercentage", agg.uptimePercentage());
        body.put("avgResponseTime", Math.round(agg.avg()));
        body.put("maxResponseTime", agg.max());
        body.put("minResponseTime", agg.min());
        body.put("p95ResponseTime", agg.p95());
        body.put("p99ResponseTime", agg.p99());
        body.put("totalIncidents", inPeriod.size());
        body.put("incidents", inPeriod);
        return body;
    }

    /** Incident JSON with Sequelize-style {@code "Monitor": {name[, url]}}. */
    Map<String, Object> withMonitor(Incident incident, Monitor monitor, boolean includeUrl) {
        Map<String, Object> m = null;
        if (monitor != null) {
            m = new LinkedHashMap<>();
            m.put("name", monitor.getName());
            if (includeUrl) {
                m.put("url", monitor.getUrl());
            }
        }
        return json.withAssociation(incident, "Monitor", m);
    }

    static double round2(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}
