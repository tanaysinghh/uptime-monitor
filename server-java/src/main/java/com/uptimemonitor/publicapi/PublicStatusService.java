package com.uptimemonitor.publicapi;

import com.uptimemonitor.common.ApiException;
import com.uptimemonitor.common.Json;
import com.uptimemonitor.domain.Incident;
import com.uptimemonitor.domain.Monitor;
import com.uptimemonitor.domain.Organization;
import com.uptimemonitor.repository.IncidentRepository;
import com.uptimemonitor.repository.MonitorRepository;
import com.uptimemonitor.repository.OrganizationRepository;
import org.springframework.data.domain.Limit;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Port of controllers/publicController.js (the public status page) and the data behind
 * badgeController.js. Daily uptime for every monitor comes from one grouped query instead
 * of one query per monitor.
 */
@Service
public class PublicStatusService {

    // Days are UTC days, as in the Node server (Sequelize runs every session in UTC) and
    // the client's uptime strips. DATE() alone would use the session time zone, which
    // PgJDBC takes from the JVM, so a server outside UTC would shift checks between days.
    private static final String DAILY_SQL = """
            SELECT "monitorId", DATE("checkedAt" AT TIME ZONE 'UTC') AS day, COUNT(id) AS total,
                   SUM(CASE WHEN "isSuccess" = true THEN 1 ELSE 0 END) AS successful
            FROM "Checks"
            WHERE "monitorId" IN (:ids) AND "checkedAt" >= :since
            GROUP BY "monitorId", DATE("checkedAt" AT TIME ZONE 'UTC')
            ORDER BY day ASC
            """;

    private static final String UPTIME_SQL = """
            SELECT COUNT(id) AS total, COALESCE(SUM(CASE WHEN "isSuccess" = true THEN 1 ELSE 0 END), 0) AS successful
            FROM "Checks" WHERE "monitorId" IN (:ids) AND "checkedAt" >= :since
            """;

    public record Uptime(long total, long successful) {
    }

    private final OrganizationRepository organizations;
    private final MonitorRepository monitors;
    private final IncidentRepository incidents;
    private final NamedParameterJdbcTemplate jdbc;
    private final Json json;

    public PublicStatusService(OrganizationRepository organizations, MonitorRepository monitors,
                               IncidentRepository incidents, NamedParameterJdbcTemplate jdbc, Json json) {
        this.organizations = organizations;
        this.monitors = monitors;
        this.incidents = incidents;
        this.jdbc = jdbc;
        this.json = json;
    }

    public Map<String, Object> statusPage(String slug) {
        Organization org = organizations.findBySlug(slug)
                .orElseThrow(() -> ApiException.notFound("Status page not found"));
        List<Monitor> visible = monitors.findPublicByOrganization(org.getId());
        List<UUID> ids = visible.stream().map(Monitor::getId).toList();

        record Day(String date, long total, long successful) {
        }
        Map<UUID, List<Day>> daily = new HashMap<>();
        if (!ids.isEmpty()) {
            var params = new MapSqlParameterSource("ids", ids)
                    .addValue("since", Timestamp.from(Instant.now().minus(Duration.ofDays(90))));
            jdbc.query(DAILY_SQL, params, rs -> {
                daily.computeIfAbsent(rs.getObject("monitorId", UUID.class), k -> new ArrayList<>())
                        .add(new Day(rs.getString("day"), rs.getLong("total"), rs.getLong("successful")));
            });
        }

        List<Map<String, Object>> monitorSummaries = new ArrayList<>();
        for (Monitor m : visible) {
            List<Day> days = daily.getOrDefault(m.getId(), List.of());
            List<Map<String, Object>> uptimeDays = days.stream().map(d -> {
                Map<String, Object> day = new LinkedHashMap<>();
                day.put("date", d.date());
                day.put("uptimePercentage", d.total() > 0 ? round2(d.successful() * 100.0 / d.total()) : 100);
                return day;
            }).toList();
            long total = days.stream().mapToLong(Day::total).sum();
            long success = days.stream().mapToLong(Day::successful).sum();

            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("id", m.getId());
            summary.put("name", m.getName());
            summary.put("status", m.getStatus());
            summary.put("lastCheckedAt", m.getLastCheckedAt());
            summary.put("overallUptime", total > 0 ? round2(success * 100.0 / total) : 100);
            summary.put("uptimeDays", uptimeDays);
            monitorSummaries.add(summary);
        }

        Map<UUID, Monitor> byId = visible.stream().collect(Collectors.toMap(Monitor::getId, Function.identity()));
        List<Map<String, Object>> active = ids.isEmpty() ? List.of()
                : incidents.findOpenByMonitorIds(ids).stream().map(i -> withMonitorName(i, byId)).toList();
        List<Map<String, Object>> recent = ids.isEmpty() ? List.of()
                : incidents.findResolvedByMonitorIds(ids, Limit.of(10)).stream().map(i -> withMonitorName(i, byId)).toList();

        Map<String, Object> organization = new LinkedHashMap<>();
        organization.put("name", org.getName());
        organization.put("slug", org.getSlug());
        organization.put("logoUrl", org.getLogoUrl());
        organization.put("brandColor", org.getBrandColor());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("organization", organization);
        body.put("overallStatus", overallStatus(visible));
        body.put("monitors", monitorSummaries);
        body.put("activeIncidents", active);
        body.put("recentIncidents", recent);
        return body;
    }

    /**
     * operational / partial_outage / major_outage. With no public monitors Node reported
     * "major_outage" (Array#every is true on an empty list); an empty page is operational.
     */
    static String overallStatus(List<Monitor> visible) {
        if (visible.isEmpty()) {
            return "operational";
        }
        boolean allUp = visible.stream().allMatch(m -> "up".equals(m.getStatus()));
        boolean allDown = visible.stream().allMatch(m -> "down".equals(m.getStatus()));
        return allDown ? "major_outage" : allUp ? "operational" : "partial_outage";
    }

    // ---- badge data ------------------------------------------------------------------

    public java.util.Optional<Organization> organization(String slug) {
        return organizations.findBySlug(slug);
    }

    public List<Monitor> visibleMonitors(Organization org) {
        return monitors.findPublicByOrganization(org.getId());
    }

    public Uptime uptime(List<UUID> monitorIds, Duration period) {
        var params = new MapSqlParameterSource("ids", monitorIds)
                .addValue("since", Timestamp.from(Instant.now().minus(period)));
        return jdbc.queryForObject(UPTIME_SQL, params,
                (rs, i) -> new Uptime(rs.getLong("total"), rs.getLong("successful")));
    }

    private Map<String, Object> withMonitorName(Incident incident, Map<UUID, Monitor> byId) {
        Monitor m = byId.get(incident.getMonitorId());
        return json.withAssociation(incident, "Monitor", m == null ? null : Map.of("name", m.getName()));
    }

    static double round2(double value) {
        // new BigDecimal(double) is the exact binary value, which is what JS toFixed(2) rounds.
        return new BigDecimal(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}
