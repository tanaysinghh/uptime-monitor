package com.uptimemonitor.realtime;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/** Used when real-time push is disabled (app.realtime.enabled=false); events are dropped. */
@Component
@ConditionalOnProperty(prefix = "app.realtime", name = "enabled", havingValue = "false")
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
