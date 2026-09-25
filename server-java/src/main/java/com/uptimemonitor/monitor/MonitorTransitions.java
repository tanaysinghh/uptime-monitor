package com.uptimemonitor.monitor;

import com.uptimemonitor.domain.Incident;
import com.uptimemonitor.domain.Monitor;
import com.uptimemonitor.repository.IncidentRepository;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * The monitor status machine shared by HTTP checks and heartbeats: a success resolves the
 * open incident of a "down" monitor; enough consecutive failures open a new incident.
 * Must be called inside a transaction with a managed Monitor; side effects (socket
 * events, alerts) are described by the returned {@link Outcome} and published after commit.
 */
@Component
public class MonitorTransitions {

    public record Outcome(Monitor monitor, String previousStatus, Incident opened, Incident resolved) {
        public boolean statusChanged() {
            return !java.util.Objects.equals(previousStatus, monitor.getStatus());
        }
    }

    private final IncidentRepository incidents;

    public MonitorTransitions(IncidentRepository incidents) {
        this.incidents = incidents;
    }

    public Outcome markUp(Monitor monitor, Instant now) {
        String previous = monitor.getStatus();
        Incident resolved = null;
        if ("down".equals(previous)) {
            resolved = resolveOpenIncident(monitor, now);
        }
        monitor.setStatus("up");
        monitor.setConsecutiveFailures(0);
        monitor.setLastCheckedAt(now);
        return new Outcome(monitor, previous, null, resolved);
    }

    public Outcome markFailure(Monitor monitor, Instant now, int threshold) {
        String previous = monitor.getStatus();
        monitor.setConsecutiveFailures(monitor.consecutiveFailureCount() + 1);
        monitor.setLastCheckedAt(now);
        Incident opened = null;
        if (monitor.getConsecutiveFailures() >= threshold && !"down".equals(previous)) {
            monitor.setStatus("down");
            opened = openIncident(monitor, now);
        }
        return new Outcome(monitor, previous, opened, null);
    }

    public Incident openIncident(Monitor monitor, Instant now) {
        Incident incident = new Incident();
        incident.setMonitorId(monitor.getId());
        incident.setStatus("investigating");
        incident.setStartedAt(now);
        return incidents.save(incident);
    }

    public Incident resolveOpenIncident(Monitor monitor, Instant now) {
        return incidents.findLatestOpen(monitor.getId()).map(open -> {
            open.setStatus("resolved");
            open.setResolvedAt(now);
            open.setDurationSeconds((int) Math.floorDiv(now.toEpochMilli() - open.getStartedAt().toEpochMilli(), 1000L));
            return incidents.save(open);
        }).orElse(null);
    }
}
