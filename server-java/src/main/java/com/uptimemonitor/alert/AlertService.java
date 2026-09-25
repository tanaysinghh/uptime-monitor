package com.uptimemonitor.alert;

import com.uptimemonitor.common.Times;
import com.uptimemonitor.domain.AlertChannel;
import com.uptimemonitor.domain.AlertLog;
import com.uptimemonitor.domain.Incident;
import com.uptimemonitor.domain.Monitor;
import com.uptimemonitor.repository.AlertChannelRepository;
import com.uptimemonitor.repository.AlertLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;

/**
 * Port of services/alertService.js: fan an up/down event out to the organization's
 * active channels, honouring each channel's cooldown, and log every delivery attempt.
 */
@Service
public class AlertService {

    private static final Logger log = LoggerFactory.getLogger(AlertService.class);

    private final AlertChannelRepository channels;
    private final AlertLogRepository alertLogs;
    private final WebhookSender sender;
    private final ExecutorService executor;

    public AlertService(AlertChannelRepository channels, AlertLogRepository alertLogs, WebhookSender sender,
                        ExecutorService backgroundExecutor) {
        this.channels = channels;
        this.alertLogs = alertLogs;
        this.sender = sender;
        this.executor = backgroundExecutor;
    }

    /** Fire-and-forget, like the un-awaited sendAlert(...).catch(log) calls in Node. */
    public void sendAlertAsync(Monitor monitor, Incident incident, String alertType) {
        executor.execute(() -> {
            try {
                sendAlert(monitor, incident, alertType);
            } catch (RuntimeException e) {
                log.error("sendAlert ({}) failed for monitor {}: {}", alertType, monitor.getId(), e.getMessage());
            }
        });
    }

    public void sendAlert(Monitor monitor, Incident incident, String alertType) {
        List<AlertChannel> active = channels.findByOrganizationIdAndIsActiveTrue(monitor.getOrganizationId());
        for (AlertChannel channel : active) {
            Instant now = Times.now();
            if (channel.getLastAlertedAt() != null) {
                long cooldownMs = Duration.ofMinutes(channel.getCooldownMinutes() == null ? 5 : channel.getCooldownMinutes()).toMillis();
                if (now.toEpochMilli() - channel.getLastAlertedAt().toEpochMilli() < cooldownMs) {
                    continue;
                }
            }

            AlertLog entry = new AlertLog();
            entry.setMonitorId(monitor.getId());
            entry.setIncidentId(incident == null ? null : incident.getId());
            entry.setChannelId(channel.getId());
            entry.setType(alertType);
            entry.setSentAt(now);
            try {
                deliver(channel, monitor, incident, alertType);
                channel.setLastAlertedAt(now);
                channels.save(channel);
                entry.setStatus("sent");
            } catch (RuntimeException e) {
                entry.setStatus("failed");
                entry.setErrorMessage(e.getMessage());
            }
            alertLogs.save(entry);
        }
    }

    private void deliver(AlertChannel channel, Monitor monitor, Incident incident, String alertType) {
        switch (channel.getType()) {
            case "webhook" -> sender.post(channel.configString("url"), webhookPayload(monitor, incident, alertType));
            case "slack" -> sender.post(channel.configString("webhookUrl"), AlertPayloads.slack(monitor, alertType));
            case "discord" -> sender.post(channel.configString("webhookUrl"), AlertPayloads.discord(monitor, alertType));
            default -> {
                // "email": accepted but not delivered - same as the Node server, which has no mailer.
            }
        }
    }

    private static Map<String, Object> webhookPayload(Monitor monitor, Incident incident, String alertType) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", monitor.getId());
        m.put("name", monitor.getName());
        m.put("url", monitor.getUrl());
        m.put("status", monitor.getStatus());

        Map<String, Object> i = null;
        if (incident != null) {
            i = new LinkedHashMap<>();
            i.put("id", incident.getId());
            i.put("status", incident.getStatus());
            i.put("startedAt", incident.getStartedAt());
            i.put("resolvedAt", incident.getResolvedAt());
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", alertType);
        payload.put("monitor", m);
        payload.put("incident", i);
        payload.put("timestamp", Instant.now());
        return payload;
    }
}
