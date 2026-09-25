package com.uptimemonitor.health;

import com.uptimemonitor.config.AppProperties;
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;
import org.springframework.boot.health.contributor.Status;
import org.springframework.boot.jdbc.health.DataSourceHealthIndicator;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.lang.management.ManagementFactory;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * GET /api/health with the exact body the Node server returned (used by the Render
 * health check). The database probe is Actuator's DataSourceHealthIndicator - the same
 * check behind the standard /actuator/health endpoint.
 */
@RestController
public class HealthController {

    private final HealthIndicator db;
    private final AppProperties props;

    public HealthController(DataSource dataSource, AppProperties props) {
        this.db = new DataSourceHealthIndicator(dataSource, "SELECT 1");
        this.props = props;
    }

    @GetMapping("/api/health")
    ResponseEntity<Map<String, Object>> health() {
        long started = System.currentTimeMillis();
        Health health = db.health(true);
        boolean dbOk = Status.UP.equals(health.getStatus());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", dbOk ? "ok" : "degraded");
        body.put("db", dbOk ? "ok" : "down");
        if (!dbOk) {
            Object error = health.getDetails().get("error");
            body.put("dbError", props.isProd() ? "unavailable" : String.valueOf(error));
        }
        body.put("uptimeSeconds", ManagementFactory.getRuntimeMXBean().getUptime() / 1000);
        body.put("timestamp", Instant.now());
        body.put("checkTimeMs", System.currentTimeMillis() - started);
        return ResponseEntity.status(dbOk ? 200 : 503).body(body);
    }
}
