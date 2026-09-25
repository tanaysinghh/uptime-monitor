package com.uptimemonitor.realtime;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/** Used when no real-time transport is running; events are dropped. */
@Component
public class NoopRealtimeEvents implements RealtimeEvents {

    @Override
    public void emitMonitorUpdate(UUID organizationId, Map<String, Object> data) {
    }

    @Override
    public void emitIncidentUpdate(UUID organizationId, String slug, Map<String, Object> data) {
    }

    @Override
    public void emitCheckResult(UUID organizationId, Map<String, Object> data) {
    }
}
