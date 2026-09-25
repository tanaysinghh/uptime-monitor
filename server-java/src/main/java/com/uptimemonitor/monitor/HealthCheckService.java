package com.uptimemonitor.monitor;

import com.uptimemonitor.common.Times;
import com.uptimemonitor.domain.Check;
import com.uptimemonitor.domain.Monitor;
import com.uptimemonitor.realtime.RealtimeEvents;
import com.uptimemonitor.repository.CheckRepository;
import com.uptimemonitor.repository.MonitorRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.stream.Collectors;

/**
 * Port of services/healthCheckService.js: probe a monitor, evaluate its assertions,
 * record the Check, drive the up/down state machine (3 consecutive failures open an
 * incident) and push results to connected dashboards.
 *
 * <p>Differences from Node: due monitors are checked concurrently (virtual threads)
 * instead of one after another, a monitor is never checked twice at once, a monitor
 * paused while its check is in flight keeps its "paused" status, responseTimeMs
 * measures only the HTTP exchange (Node also counted the separate TLS certificate probe),
 * and lastCheckedAt is the check's start time so intervals equal to the 30s tick are honoured.
 */
@Service
public class HealthCheckService {

    private static final Logger log = LoggerFactory.getLogger(HealthCheckService.class);
    static final int FAILURE_THRESHOLD = 3;
    /** Absorbs scheduler jitter so a monitor whose interval equals the tick isn't skipped. */
    static final long DUE_TOLERANCE_MS = 2000;

    private final MonitorRepository monitors;
    private final CheckRepository checks;
    private final HttpProber prober;
    private final SslInspector sslInspector;
    private final MonitorTransitions transitions;
    private final MonitorEventPublisher publisher;
    private final RealtimeEvents realtime;
    private final TransactionTemplate tx;
    private final ExecutorService executor;
    private final Set<UUID> inFlight = ConcurrentHashMap.newKeySet();

    public HealthCheckService(MonitorRepository monitors, CheckRepository checks, HttpProber prober,
                              SslInspector sslInspector, MonitorTransitions transitions,
                              MonitorEventPublisher publisher, RealtimeEvents realtime, TransactionTemplate tx,
                              ExecutorService backgroundExecutor) {
        this.monitors = monitors;
        this.checks = checks;
        this.prober = prober;
        this.sslInspector = sslInspector;
        this.transitions = transitions;
        this.publisher = publisher;
        this.realtime = realtime;
        this.tx = tx;
        this.executor = backgroundExecutor;
    }

    /** Checks every active HTTP monitor whose interval has elapsed and waits for all of them. */
    public int checkAllMonitors() {
        long now = System.currentTimeMillis();
        List<Monitor> due = monitors.findActiveHttpMonitors().stream()
                .filter(m -> {
                    long last = m.getLastCheckedAt() == null ? 0 : m.getLastCheckedAt().toEpochMilli();
                    int interval = m.getIntervalSeconds() == null ? 300 : m.getIntervalSeconds();
                    return (now - last) + DUE_TOLERANCE_MS >= interval * 1000L;
                })
                .toList();

        List<Future<?>> running = new ArrayList<>();
        for (Monitor monitor : due) {
            if (!inFlight.add(monitor.getId())) {
                continue;
            }
            running.add(executor.submit(() -> {
                try {
                    performCheck(monitor);
                } catch (RuntimeException e) {
                    log.error("Error checking monitor {}: {}", monitor.getId(), e.getMessage());
                } finally {
                    inFlight.remove(monitor.getId());
                }
            }));
        }
        for (Future<?> f : running) {
            try {
                f.get();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception ignored) {
                // already logged by the task
            }
        }
        return running.size();
    }

    /** Runs one check. Returns null when skipped (maintenance window, or monitor deleted). */
    public Check performCheck(Monitor monitor) {
        if (monitor.inMaintenance()) {
            if (monitor.getMaintenanceEndAt() != null && Instant.now().isAfter(monitor.getMaintenanceEndAt())) {
                endMaintenance(monitor.getId());
                monitor.setMaintenanceMode(false);
            } else {
                return null;
            }
        }

        Instant startedAt = Times.now();
        HttpProber.Result probe = prober.probe(monitor);
        Integer statusCode = probe.statusCode();
        boolean isSuccess = false;
        String errorMessage = probe.error();
        List<Map<String, Object>> assertionResults = null;
        List<Map<String, Object>> assertions = monitor.getAssertions() == null ? List.of() : monitor.getAssertions();

        if (statusCode != null) {
            isSuccess = Objects.equals(statusCode, monitor.getExpectedStatus());
            if (!isSuccess) {
                errorMessage = "Expected status " + monitor.getExpectedStatus() + ", got " + statusCode;
            }
            if (!assertions.isEmpty()) {
                AssertionEvaluator.Evaluation eval = AssertionEvaluator.evaluate(assertions, probe.body(), statusCode);
                assertionResults = new ArrayList<>(eval.results());
                if (!eval.passed()) {
                    isSuccess = false;
                    String failed = eval.results().stream()
                            .filter(r -> !Boolean.TRUE.equals(r.get("passed")))
                            .map(r -> r.get("type") + ": expected "
                                    + (AssertionEvaluator.truthy(r.get("value")) ? AssertionEvaluator.jsString(r.get("value")) : "")
                                    + ", got "
                                    + (AssertionEvaluator.truthy(r.get("actual")) ? r.get("actual") : ""))
                            .collect(Collectors.joining("; "));
                    errorMessage = errorMessage != null
                            ? errorMessage + " | Assertions failed: " + failed
                            : "Assertions failed: " + failed;
                }
            }
        }

        int responseTimeMs = (int) probe.elapsedMs();

        for (Map<String, Object> rta : assertions) {
            if (!"response_time".equals(rta.get("type"))) {
                continue;
            }
            Double limit = AssertionEvaluator.parseInt(rta.get("value"));
            boolean passed = limit != null && responseTimeMs <= limit;
            if (!passed) {
                isSuccess = false;
                String msg = "Response time " + responseTimeMs + "ms exceeds "
                        + AssertionEvaluator.jsString(rta.get("value")) + "ms";
                errorMessage = errorMessage != null ? errorMessage + " | " + msg : msg;
            }
            if (assertionResults != null) {
                for (Map<String, Object> r : assertionResults) {
                    if ("response_time".equals(r.get("type")) && Objects.equals(r.get("value"), rta.get("value"))) {
                        r.put("passed", passed);
                        r.put("actual", responseTimeMs + "ms");
                        break;
                    }
                }
            }
        }

        Map<String, Object> sslInfo = sslInfoFor(monitor.getUrl());

        Check check = new Check();
        check.setMonitorId(monitor.getId());
        check.setStatusCode(statusCode);
        check.setResponseTimeMs(responseTimeMs);
        check.setIsSuccess(isSuccess);
        check.setErrorMessage(errorMessage);
        check.setCheckedAt(Times.now());

        final boolean success = isSuccess;
        MonitorTransitions.Outcome outcome = tx.execute(status -> {
            Monitor fresh = monitors.findById(monitor.getId()).orElse(null);
            if (fresh == null) {
                return null; // deleted while the request was in flight
            }
            checks.save(check);
            if ("paused".equals(fresh.getStatus())) {
                return new MonitorTransitions.Outcome(fresh, "paused", null, null);
            }
            MonitorTransitions.Outcome result = success
                    ? transitions.markUp(fresh, Times.now())
                    : transitions.markFailure(fresh, Times.now(), FAILURE_THRESHOLD);
            // The interval is measured from when a check *starts*, so a 30s monitor is due on
            // every 30s scheduler tick (stamping the end time made it wait for every other tick).
            fresh.setLastCheckedAt(startedAt);
            return result;
        });
        if (outcome == null) {
            return null;
        }
        publisher.publish(outcome);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("monitorId", monitor.getId());
        result.put("statusCode", statusCode);
        result.put("responseTimeMs", responseTimeMs);
        result.put("isSuccess", isSuccess);
        result.put("errorMessage", errorMessage);
        result.put("checkedAt", check.getCheckedAt());
        result.put("sslInfo", sslInfo);
        result.put("assertionResults", assertionResults);
        realtime.emitCheckResult(monitor.getOrganizationId(), result);
        return check;
    }

    private void endMaintenance(UUID monitorId) {
        tx.executeWithoutResult(status -> monitors.findById(monitorId).ifPresent(m -> {
            m.setMaintenanceMode(false);
            m.setMaintenanceStartAt(null);
            m.setMaintenanceEndAt(null);
            m.setMaintenanceReason(null);
        }));
    }

    private Map<String, Object> sslInfoFor(String url) {
        try {
            URI uri = URI.create(url);
            if ("https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null) {
                return sslInspector.inspect(uri.getHost());
            }
        } catch (IllegalArgumentException ignored) {
            // invalid URL: no TLS info
        }
        return null;
    }
}
