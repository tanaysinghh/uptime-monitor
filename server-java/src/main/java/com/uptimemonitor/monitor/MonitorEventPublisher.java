package com.uptimemonitor.monitor;

import com.uptimemonitor.alert.AlertService;
import com.uptimemonitor.common.Json;
import com.uptimemonitor.domain.Incident;
import com.uptimemonitor.domain.Monitor;
import com.uptimemonitor.domain.Organization;
import com.uptimemonitor.realtime.RealtimeEvents;
import com.uptimemonitor.repository.OrganizationRepository;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/** Publishes the side effects of a status transition: socket events, then alerts. */
@Component
public class MonitorEventPublisher {

    private final RealtimeEvents realtime;
    private final AlertService alerts;
    private final OrganizationRepository organizations;
    private final Json json;

    public MonitorEventPublisher(RealtimeEvents realtime, AlertService alerts, OrganizationRepository organizations,
                                 Json json) {
        this.realtime = realtime;
        this.alerts = alerts;
        this.organizations = organizations;
        this.json = json;
    }

    public void publish(MonitorTransitions.Outcome outcome) {
        Monitor monitor = outcome.monitor();
        if (outcome.resolved() != null) {
            incidentUpdate(monitor, outcome.resolved(), "resolved");
            alerts.sendAlertAsync(monitor, outcome.resolved(), "up");
        }
        if (outcome.opened() != null) {
            incidentUpdate(monitor, outcome.opened(), "new");
            alerts.sendAlertAsync(monitor, outcome.opened(), "down");
        }
        if (outcome.statusChanged()) {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("monitorId", monitor.getId());
            data.put("name", monitor.getName());
            data.put("previousStatus", outcome.previousStatus());
            data.put("currentStatus", monitor.getStatus());
            realtime.emitMonitorUpdate(monitor.getOrganizationId(), data);
        }
    }

    private void incidentUpdate(Monitor monitor, Incident incident, String type) {
        String slug = organizations.findById(monitor.getOrganizationId()).map(Organization::getSlug).orElse(null);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("type", type);
        data.put("incident", json.toMap(incident));
        data.put("monitorName", monitor.getName());
        realtime.emitIncidentUpdate(monitor.getOrganizationId(), slug, data);
    }
}
