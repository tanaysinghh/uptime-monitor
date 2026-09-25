package com.uptimemonitor.realtime;

import java.util.Map;
import java.util.UUID;

/**
 * Push notifications to connected dashboards / status pages (services/socketService.js).
 * Rooms: "org:{organizationId}" for dashboards, "status:{slug}" for public status pages.
 */
public interface RealtimeEvents {

    String MONITOR_UPDATE = "monitor:update";
    String INCIDENT_UPDATE = "incident:update";
    String CHECK_RESULT = "check:result";

    /** {monitorId, name, previousStatus, currentStatus} to the org room. */
    void emitMonitorUpdate(UUID organizationId, Map<String, Object> data);

    /** {type: "new"|"resolved", incident, monitorName} to the org room and the status page room. */
    void emitIncidentUpdate(UUID organizationId, String slug, Map<String, Object> data);

    /** Every check result to the org room. */
    void emitCheckResult(UUID organizationId, Map<String, Object> data);
}
