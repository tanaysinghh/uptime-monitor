package com.uptimemonitor.monitor;

import com.uptimemonitor.domain.Monitor;
import com.uptimemonitor.repository.MonitorRepository;
import com.uptimemonitor.support.ApiTestBase;
import com.uptimemonitor.support.Fixtures;
import com.uptimemonitor.support.TestApi;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

class StatsApiTest extends ApiTestBase {

    @Autowired
    Fixtures fixtures;
    @Autowired
    MonitorRepository monitors;
    @Autowired
    MonitorTransitions transitions;

    @Test
    void dashboardAggregatesTheLast24HoursForTheOrganization() throws Exception {
        TestApi.Registered org = api.register();
        Monitor up = fixtures.monitor(org.organizationId(), "https://93.184.216.34/");
        up.setStatus("up");
        monitors.save(up);
        Monitor down = fixtures.monitor(org.organizationId(), "https://93.184.216.35/");
        down.setStatus("down");
        down.setMaintenanceMode(true);
        monitors.save(down);
        Monitor paused = fixtures.monitor(org.organizationId(), "https://93.184.216.36/");
        paused.setStatus("paused");
        monitors.save(paused);
        transitions.openIncident(down, Instant.now());

        Instant now = Instant.now();
        // 20 checks: response times 10..200, 19 successes; plus one outside the window
        for (int i = 1; i <= 20; i++) {
            fixtures.check(up.getId(), i != 20, i * 10, now.minus(i, ChronoUnit.MINUTES));
        }
        fixtures.check(up.getId(), false, 5000, now.minus(2, ChronoUnit.DAYS));

        JsonNode s = api.get("/api/stats/dashboard", org.accessToken()).body();
        assertThat(s.get("totalMonitors").asInt()).isEqualTo(3);
        assertThat(s.get("monitorsUp").asInt()).isEqualTo(1);
        assertThat(s.get("monitorsDown").asInt()).isEqualTo(1);
        assertThat(s.get("monitorsPaused").asInt()).isEqualTo(1);
        assertThat(s.get("monitorsInMaintenance").asInt()).isEqualTo(1);
        assertThat(s.get("totalChecks").asInt()).isEqualTo(20);
        assertThat(s.get("uptimePercentage").asDouble()).isEqualTo(95.0);
        assertThat(s.get("avgResponseTime").asInt()).isEqualTo(105);
        // nearest-rank: ceil(0.95*20)-1 = index 18 -> 190; ceil(0.99*20)-1 = 19 -> 200
        assertThat(s.get("p95ResponseTime").asInt()).isEqualTo(190);
        assertThat(s.get("p99ResponseTime").asInt()).isEqualTo(200);
        JsonNode incident = s.get("activeIncidents").get(0);
        assertThat(incident.get("Monitor").get("name").asString()).isEqualTo(down.getName());
        assertThat(incident.get("Monitor").get("url").asString()).isEqualTo(down.getUrl());
    }

    @Test
    void emptyOrganizationGetsNeutralStats() throws Exception {
        JsonNode s = api.get("/api/stats/dashboard", api.register().accessToken()).body();
        assertThat(s.get("totalMonitors").asInt()).isZero();
        assertThat(s.get("uptimePercentage").asDouble()).isEqualTo(100.0);
        assertThat(s.get("avgResponseTime").asInt()).isZero();
        assertThat(s.get("p95ResponseTime").asInt()).isZero();
        assertThat(s.get("activeIncidents").size()).isZero();
    }

    @Test
    void monitorStatsForAPeriod() throws Exception {
        TestApi.Registered org = api.register();
        Monitor m = fixtures.monitor(org.organizationId(), "https://93.184.216.34/");
        Instant now = Instant.now();
        fixtures.check(m.getId(), true, 100, now.minus(1, ChronoUnit.HOURS));
        fixtures.check(m.getId(), false, 300, now.minus(2, ChronoUnit.HOURS));
        fixtures.check(m.getId(), true, 200, now.minus(3, ChronoUnit.DAYS));
        transitions.openIncident(m, now.minus(4, ChronoUnit.DAYS));

        JsonNode day = api.get("/api/stats/monitors/" + m.getId(), org.accessToken()).body();
        assertThat(day.get("period").asString()).isEqualTo("24h");
        assertThat(day.get("totalChecks").asInt()).isEqualTo(2);
        assertThat(day.get("uptimePercentage").asDouble()).isEqualTo(50.0);
        assertThat(day.get("maxResponseTime").asInt()).isEqualTo(300);
        assertThat(day.get("minResponseTime").asInt()).isEqualTo(100);
        assertThat(day.get("totalIncidents").asInt()).isZero();
        assertThat(day.get("monitor").get("id").asString()).isEqualTo(m.getId().toString());

        JsonNode week = api.get("/api/stats/monitors/" + m.getId() + "?period=7d", org.accessToken()).body();
        assertThat(week.get("totalChecks").asInt()).isEqualTo(3);
        assertThat(week.get("avgResponseTime").asInt()).isEqualTo(200);
        assertThat(week.get("totalIncidents").asInt()).isEqualTo(1);
        assertThat(week.get("uptimePercentage").asDouble()).isEqualTo(66.67);
    }

    @Test
    void monitorStatsAre404ForOtherOrganizationsAndBadIds() throws Exception {
        TestApi.Registered owner = api.register();
        Monitor m = fixtures.monitor(owner.organizationId(), "https://93.184.216.34/");
        String stranger = api.register().accessToken();
        assertThat(api.get("/api/stats/monitors/" + m.getId(), stranger).status()).isEqualTo(404);
        assertThat(api.get("/api/stats/monitors/nope", stranger).error()).isEqualTo("Monitor not found");
    }
}
