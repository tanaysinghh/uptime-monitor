package com.uptimemonitor.publicapi;

import com.uptimemonitor.common.Crypto;
import com.uptimemonitor.domain.Monitor;
import com.uptimemonitor.monitor.MonitorTransitions;
import com.uptimemonitor.repository.MonitorRepository;
import com.uptimemonitor.repository.SubscriberRepository;
import com.uptimemonitor.support.ApiTestBase;
import com.uptimemonitor.support.Fixtures;
import com.uptimemonitor.support.TestApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PublicApiTest extends ApiTestBase {

    @Autowired
    Fixtures fixtures;
    @Autowired
    MonitorRepository monitors;
    @Autowired
    MonitorTransitions transitions;
    @Autowired
    SubscriberRepository subscribers;

    private TestApi.Registered org;

    @BeforeEach
    void registerOrg() throws Exception {
        org = api.register();
    }

    private Monitor monitor(String name, String status) {
        Monitor m = fixtures.monitor(org.organizationId(), "https://93.184.216.34/");
        m.setName(name);
        m.setStatus(status);
        return monitors.save(m);
    }

    // ---- status page -----------------------------------------------------------------

    @Test
    void statusPageShowsVisibleMonitorsDailyUptimeAndIncidents() throws Exception {
        Monitor api1 = monitor("B api", "up");
        Monitor web = monitor("A web", "down");
        monitor("C paused", "paused");
        Instant now = Instant.now();
        fixtures.check(api1.getId(), true, 100, now.minus(1, ChronoUnit.HOURS));
        fixtures.check(api1.getId(), false, 100, now.minus(2, ChronoUnit.HOURS));
        fixtures.check(api1.getId(), true, 100, now.minus(3, ChronoUnit.DAYS));
        transitions.openIncident(web, now);
        var resolved = transitions.openIncident(api1, now.minus(5, ChronoUnit.DAYS));
        transitions.resolveOpenIncident(api1, now.minus(4, ChronoUnit.DAYS));

        TestApi.Response r = api.get("/api/public/status/" + org.slug());
        assertThat(r.status()).isEqualTo(200);
        JsonNode body = r.body();
        assertThat(body.get("organization").propertyNames()).containsExactly("name", "slug", "logoUrl", "brandColor");
        assertThat(body.get("overallStatus").asString()).isEqualTo("partial_outage");
        JsonNode list = body.get("monitors");
        assertThat(list.findValuesAsString("name")).containsExactly("A web", "B api"); // name asc, paused hidden
        JsonNode apiSummary = list.get(1);
        assertThat(apiSummary.propertyNames())
                .containsExactly("id", "name", "status", "lastCheckedAt", "overallUptime", "uptimeDays");
        assertThat(apiSummary.get("overallUptime").asDouble()).isEqualTo(66.67);
        assertThat(apiSummary.get("uptimeDays").get(0).get("date").asString()).matches("\\d{4}-\\d{2}-\\d{2}");
        assertThat(list.get(0).get("overallUptime").asDouble()).isEqualTo(100.0);
        assertThat(list.get(0).get("uptimeDays").size()).isZero();

        assertThat(body.get("activeIncidents").size()).isEqualTo(1);
        assertThat(body.get("activeIncidents").get(0).get("Monitor").get("name").asString()).isEqualTo("A web");
        assertThat(body.get("recentIncidents").get(0).get("id").asString()).isEqualTo(resolved.getId().toString());
        assertThat(body.get("recentIncidents").get(0).get("Monitor").get("name").asString()).isEqualTo("B api");
    }

    @Test
    void dailyUptimeUsesUtcDaysWhateverTheServerTimeZone() throws Exception {
        // 20:00 UTC is already the next day in UTC+5:30 (this machine) or anywhere east of
        // UTC+4; both checks must still land in the same UTC day, like the Node server.
        Monitor m = monitor("tz", "up");
        Instant day = Instant.now().truncatedTo(ChronoUnit.DAYS).minus(2, ChronoUnit.DAYS);
        fixtures.check(m.getId(), true, 10, day.plus(10, ChronoUnit.HOURS));
        fixtures.check(m.getId(), false, 10, day.plus(20, ChronoUnit.HOURS));

        JsonNode days = api.get("/api/public/status/" + org.slug()).body().get("monitors").get(0).get("uptimeDays");
        assertThat(days.size()).isEqualTo(1);
        assertThat(days.get(0).get("date").asString()).isEqualTo(day.toString().substring(0, 10));
        assertThat(days.get(0).get("uptimePercentage").asDouble()).isEqualTo(50.0);
    }

    @Test
    void overallStatusVariants() throws Exception {
        assertThat(api.get("/api/public/status/" + org.slug()).body().get("overallStatus").asString())
                .isEqualTo("operational");
        Monitor m = monitor("only", "down");
        assertThat(api.get("/api/public/status/" + org.slug()).body().get("overallStatus").asString())
                .isEqualTo("major_outage");
        m.setStatus("up");
        monitors.save(m);
        assertThat(api.get("/api/public/status/" + org.slug()).body().get("overallStatus").asString())
                .isEqualTo("operational");
    }

    @Test
    void unknownStatusPageIs404() throws Exception {
        TestApi.Response r = api.get("/api/public/status/no-such-org");
        assertThat(r.status()).isEqualTo(404);
        assertThat(r.error()).isEqualTo("Status page not found");
    }

    // ---- badges ----------------------------------------------------------------------

    @Test
    void statusBadgeIsByteIdenticalToTheNodeRendering() throws Exception {
        monitor("x", "up");
        TestApi.Response r = api.get("/api/public/status/" + org.slug() + "/badge.svg");
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.header("Content-Type")).isEqualTo("image/svg+xml; charset=utf-8");
        assertThat(r.header("Cache-Control")).isEqualTo("public, max-age=60, s-maxage=60");
        String svg = r.raw().getResponse().getContentAsString();
        // sha256 of renderBadge("status", "operational", "#22c55e") from badgeController.js
        assertThat(Crypto.sha256Hex(svg)).isEqualTo("98d817ad48f3e18643c84e261d18e27bb3d9b343fa5616a0ca5d3b7a84ee2202");
    }

    @Test
    void badgeRendererMatchesNodeForEdgeCases() {
        assertThat(Crypto.sha256Hex(BadgeRenderer.render("uptime 90d", "99.50%", "#eab308")))
                .isEqualTo("2ecb10d68c3f384be858e3625f4d1f1f4701e4b734216e12c7a5431996525e5e");
        assertThat(Crypto.sha256Hex(BadgeRenderer.render("status", "no monitors", "#9ca3af")))
                .isEqualTo("3147c4c701f5a601676d1a7544b63729e0f3cc4d22d19abc6e8256df560f4728");
        assertThat(Crypto.sha256Hex(BadgeRenderer.render("x<&>\"'", "y", "#555")))
                .isEqualTo("e87bc9e549bb0eb9a075c8d65e7f7f14d0968b6257ea211272e8966df8140ee6");
    }

    @Test
    void badgeStates() throws Exception {
        assertThat(api.get("/api/public/status/nobody/badge.svg").raw().getResponse().getContentAsString())
                .contains("not found");
        assertThat(api.get("/api/public/status/" + org.slug() + "/badge.svg").raw().getResponse().getContentAsString())
                .contains("no monitors");
        Monitor m = monitor("x", "down");
        assertThat(api.get("/api/public/status/" + org.slug() + "/badge.svg").raw().getResponse().getContentAsString())
                .contains("major outage");
        assertThat(api.get("/api/public/status/" + org.slug() + "/uptime.svg").raw().getResponse().getContentAsString())
                .contains("uptime 90d: n/a");

        Instant now = Instant.now();
        for (int i = 0; i < 199; i++) {
            fixtures.check(m.getId(), true, 10, now.minus(i, ChronoUnit.MINUTES));
        }
        fixtures.check(m.getId(), false, 10, now.minus(3, ChronoUnit.HOURS));
        String week = api.get("/api/public/status/" + org.slug() + "/uptime.svg?period=7d")
                .raw().getResponse().getContentAsString();
        assertThat(week).contains("uptime 7d: 99.50%").contains("#22c55e"); // >= 99% is green
    }

    // ---- subscribers -----------------------------------------------------------------

    @Test
    void subscribeUnsubscribeAndList() throws Exception {
        TestApi.Response sub = api.post("/api/public/status/" + org.slug() + "/subscribe",
                Map.of("email", "Fan+news@GMAIL.com"));
        assertThat(sub.status()).isEqualTo(201);
        assertThat(sub.body().get("message").asString()).isEqualTo("Subscribed successfully");
        assertThat(api.post("/api/public/status/" + org.slug() + "/subscribe", Map.of("email", "fan@gmail.com")).error())
                .isEqualTo("Already subscribed");
        assertThat(api.post("/api/public/status/nobody/subscribe", Map.of("email", "a@example.com")).error())
                .isEqualTo("Status page not found");
        assertThat(api.post("/api/public/status/" + org.slug() + "/subscribe", Map.of("email", "nope")).status())
                .isEqualTo(400);

        assertThat(api.get("/api/public/subscribers").status()).isEqualTo(401);
        JsonNode list = api.get("/api/public/subscribers", org.accessToken()).body().get("subscribers");
        assertThat(list.size()).isEqualTo(1);
        assertThat(list.get(0).get("email").asString()).isEqualTo("fan@gmail.com");
        assertThat(list.get(0).get("confirmed").asBoolean()).isTrue();
        String token = list.get(0).get("confirmToken").asString();

        assertThat(api.get("/api/public/unsubscribe/" + token).body().get("message").asString())
                .isEqualTo("Unsubscribed successfully");
        assertThat(api.get("/api/public/unsubscribe/" + token).error()).isEqualTo("Subscriber not found");
        assertThat(subscribers.findByConfirmToken(token)).isEmpty();
    }
}
