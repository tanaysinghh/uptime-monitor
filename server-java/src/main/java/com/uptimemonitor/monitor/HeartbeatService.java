package com.uptimemonitor.monitor;

import com.uptimemonitor.common.ApiException;
import com.uptimemonitor.common.Crypto;
import com.uptimemonitor.common.RequestValidator;
import com.uptimemonitor.common.Times;
import com.uptimemonitor.domain.Check;
import com.uptimemonitor.domain.Monitor;
import com.uptimemonitor.repository.CheckRepository;
import com.uptimemonitor.repository.MonitorRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Port of services/heartbeatService.js ("dead man's switch" monitors): jobs ping
 * /api/heartbeat/:token; a monitor goes down (and opens an incident) once no ping has
 * arrived for 1.5x its interval.
 *
 * <p>Differences from Node: a never-pinged monitor gets its grace period measured from
 * creation (Node marked every new heartbeat monitor down on the first 30s tick), and a
 * ping to a paused monitor is recorded without un-pausing it.
 */
@Service
public class HeartbeatService {

    private static final Logger log = LoggerFactory.getLogger(HeartbeatService.class);
    static final int FAILURE_THRESHOLD = 1;

    private final MonitorRepository monitors;
    private final CheckRepository checks;
    private final MonitorTransitions transitions;
    private final MonitorEventPublisher publisher;
    private final TransactionTemplate tx;

    public HeartbeatService(MonitorRepository monitors, CheckRepository checks, MonitorTransitions transitions,
                            MonitorEventPublisher publisher, TransactionTemplate tx) {
        this.monitors = monitors;
        this.checks = checks;
        this.transitions = transitions;
        this.publisher = publisher;
        this.tx = tx;
    }

    public Map<String, Object> create(UUID organizationId, Map<String, Object> body) {
        RequestValidator v = RequestValidator.of(body);
        String name = v.string("name", 1, 200, true, null);
        Integer interval = v.optionalInt("heartbeatInterval", 30, 86400);
        List<?> tags = v.has("tags") && v.raw("tags") != null ? v.optionalArray("tags") : null;
        v.validate();

        String token = Crypto.randomHex(16);
        int effectiveInterval = interval != null ? interval : 300;
        Monitor m = new Monitor();
        m.setName(name);
        m.setUrl("heartbeat://" + token);
        m.setMethod("GET");
        m.setMonitorType("heartbeat");
        m.setHeartbeatInterval(effectiveInterval);
        m.setHeartbeatToken(token);
        m.setIntervalSeconds(effectiveInterval);
        List<String> tagList = new ArrayList<>();
        if (tags != null) {
            tags.forEach(t -> tagList.add(String.valueOf(t)));
        }
        m.setTags(tagList);
        m.setOrganizationId(organizationId);
        monitors.save(m);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("monitor", m);
        response.put("pingUrl", "/api/heartbeat/" + token);
        return response;
    }

    public Map<String, Object> receive(String token) {
        Instant now = Times.now();
        MonitorTransitions.Outcome outcome = tx.execute(status -> {
            Monitor monitor = monitors.findByHeartbeatToken(token)
                    .orElseThrow(() -> ApiException.notFound("Heartbeat monitor not found"));

            Check check = new Check();
            check.setMonitorId(monitor.getId());
            check.setStatusCode(200);
            check.setResponseTimeMs(0);
            check.setIsSuccess(true);
            check.setCheckedAt(now);
            checks.save(check);

            monitor.setLastHeartbeatAt(now);
            if ("paused".equals(monitor.getStatus())) {
                monitor.setLastCheckedAt(now);
                return new MonitorTransitions.Outcome(monitor, "paused", null, null);
            }
            return transitions.markUp(monitor, now);
        });
        publisher.publish(outcome);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "ok");
        response.put("received", now);
        return response;
    }

    /** Scheduled sweep: mark overdue heartbeat monitors down. */
    public void checkHeartbeatMonitors() {
        long now = System.currentTimeMillis();
        for (Monitor candidate : monitors.findActiveHeartbeatMonitors()) {
            Instant baseline = candidate.getLastHeartbeatAt() != null ? candidate.getLastHeartbeatAt() : candidate.getCreatedAt();
            long lastBeat = baseline == null ? 0 : baseline.toEpochMilli();
            double elapsedSeconds = (now - lastBeat) / 1000.0;
            int interval = candidate.getHeartbeatInterval() == null ? 300 : candidate.getHeartbeatInterval();
            if (elapsedSeconds <= interval * 1.5 || "down".equals(candidate.getStatus())) {
                continue;
            }
            try {
                MonitorTransitions.Outcome outcome = tx.execute(status -> markMissed(candidate.getId(), elapsedSeconds));
                if (outcome != null) {
                    publisher.publish(outcome);
                }
            } catch (RuntimeException e) {
                log.error("Heartbeat checker error for monitor {}: {}", candidate.getId(), e.getMessage());
            }
        }
    }

    private MonitorTransitions.Outcome markMissed(UUID monitorId, double elapsedSeconds) {
        Monitor monitor = monitors.findById(monitorId).orElse(null);
        if (monitor == null || "down".equals(monitor.getStatus()) || "paused".equals(monitor.getStatus())) {
            return null;
        }
        Instant now = Times.now();
        String previous = monitor.getStatus();
        monitor.setConsecutiveFailures(monitor.consecutiveFailureCount() + 1);
        if (monitor.getConsecutiveFailures() < FAILURE_THRESHOLD) {
            return null;
        }
        monitor.setStatus("down");
        monitor.setLastCheckedAt(now);

        Check check = new Check();
        check.setMonitorId(monitor.getId());
        check.setIsSuccess(false);
        check.setErrorMessage("No heartbeat received in " + (long) Math.floor(elapsedSeconds) + " seconds");
        check.setCheckedAt(now);
        checks.save(check);

        return new MonitorTransitions.Outcome(monitor, previous, transitions.openIncident(monitor, now), null);
    }
}
