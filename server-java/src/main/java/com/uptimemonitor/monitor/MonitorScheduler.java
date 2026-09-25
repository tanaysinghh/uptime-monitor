package com.uptimemonitor.monitor;

import com.uptimemonitor.repository.CheckRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * services/scheduler.js + dataCleanup.js: HTTP checks and heartbeat sweeps every 30s, check-row retention
 * (90 days) nightly at 03:00. Disabled with app.scheduler.enabled=false (tests).
 * Scheduled tasks are cancelled on shutdown before the DataSource closes.
 */
@Component
@EnableScheduling
@ConditionalOnProperty(prefix = "app.scheduler", name = "enabled", havingValue = "true", matchIfMissing = true)
public class MonitorScheduler {

    private static final Logger log = LoggerFactory.getLogger(MonitorScheduler.class);
    static final Duration RETENTION = Duration.ofDays(90);

    private final HealthCheckService healthChecks;
    private final HeartbeatService heartbeats;
    private final CheckRepository checks;
    private final AtomicBoolean heartbeatRunning = new AtomicBoolean();

    public MonitorScheduler(HealthCheckService healthChecks, HeartbeatService heartbeats, CheckRepository checks) {
        this.healthChecks = healthChecks;
        this.heartbeats = heartbeats;
        this.checks = checks;
        log.info("Health check scheduler started");
    }

    /** Non-blocking: checks run on virtual threads, so a slow monitor can't make the next tick skip. */
    @Scheduled(cron = "*/30 * * * * *")
    void runHttpChecks() {
        try {
            healthChecks.startDueChecks();
        } catch (RuntimeException e) {
            log.error("Scheduler error: {}", e.getMessage());
        }
    }

    @Scheduled(cron = "*/30 * * * * *")
    void runHeartbeatChecks() {
        if (!heartbeatRunning.compareAndSet(false, true)) {
            return;
        }
        try {
            heartbeats.checkHeartbeatMonitors();
        } catch (RuntimeException e) {
            log.error("Heartbeat checker error: {}", e.getMessage());
        } finally {
            heartbeatRunning.set(false);
        }
    }

    @Scheduled(cron = "0 0 3 * * *")
    void cleanupOldChecks() {
        try {
            int deleted = checks.deleteOlderThan(Instant.now().minus(RETENTION));
            if (deleted > 0) {
                log.info("Cleaned up {} old check records", deleted);
            }
        } catch (RuntimeException e) {
            log.error("Data cleanup error: {}", e.getMessage());
        }
    }
}
