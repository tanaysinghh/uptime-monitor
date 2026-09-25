package com.uptimemonitor.alert;

import com.uptimemonitor.common.ApiException;
import com.uptimemonitor.common.Json;
import com.uptimemonitor.common.RequestValidator;
import com.uptimemonitor.domain.AlertChannel;
import com.uptimemonitor.domain.AlertLog;
import com.uptimemonitor.domain.Monitor;
import com.uptimemonitor.repository.AlertChannelRepository;
import com.uptimemonitor.repository.AlertLogRepository;
import com.uptimemonitor.repository.MonitorRepository;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Port of controllers/alertController.js. */
@Service
public class AlertChannelService {

    private final AlertChannelRepository channels;
    private final AlertLogRepository alertLogs;
    private final MonitorRepository monitors;
    private final WebhookSender sender;
    private final Json json;

    public AlertChannelService(AlertChannelRepository channels, AlertLogRepository alertLogs,
                               MonitorRepository monitors, WebhookSender sender, Json json) {
        this.channels = channels;
        this.alertLogs = alertLogs;
        this.monitors = monitors;
        this.sender = sender;
        this.json = json;
    }

    public List<AlertChannel> list(UUID organizationId) {
        return channels.findByOrganizationIdOrderByCreatedAtDesc(organizationId);
    }

    public AlertChannel create(UUID organizationId, Map<String, Object> body) {
        RequestValidator v = RequestValidator.of(body);
        String name = v.string("name", 1, 200, true, null);
        String type = v.in("type", RequestValidator.CHANNEL_TYPES, false);
        Map<String, Object> config = v.object("config", false);
        Integer cooldown = v.optionalInt("cooldownMinutes", 0, 1440);
        v.validate();

        AlertChannel channel = new AlertChannel();
        channel.setOrganizationId(organizationId);
        channel.setName(name);
        channel.setType(type);
        channel.setConfig(config);
        channel.setCooldownMinutes(cooldown != null && cooldown != 0 ? cooldown : 5); // `cooldownMinutes || 5`
        return channels.save(channel);
    }

    /**
     * Updates name/type/config/isActive/cooldownMinutes when present. Node applied these
     * unvalidated (bad values surfaced as 500s from the database); here they are 400s.
     */
    public AlertChannel update(UUID organizationId, UUID id, Map<String, Object> body) {
        RequestValidator v = RequestValidator.of(body);
        String name = v.optionalString("name", 1, 200, true, null);
        String type = v.in("type", RequestValidator.CHANNEL_TYPES, true);
        Map<String, Object> config = v.object("config", true);
        Integer cooldown = v.optionalInt("cooldownMinutes", 0, 1440);
        if (v.has("isActive") && !(v.raw("isActive") instanceof Boolean)) {
            v.in("isActive", List.of("true", "false"), false);
        }
        v.validate();

        AlertChannel channel = get(organizationId, id);
        if (v.has("name")) channel.setName(name);
        if (v.has("type")) channel.setType(type);
        if (v.has("config")) channel.setConfig(config);
        if (v.has("isActive")) channel.setIsActive(Boolean.valueOf(String.valueOf(v.raw("isActive"))));
        if (v.has("cooldownMinutes")) channel.setCooldownMinutes(cooldown);
        return channels.save(channel);
    }

    @Transactional
    public void delete(UUID organizationId, UUID id) {
        AlertChannel channel = get(organizationId, id);
        alertLogs.deleteByChannelId(channel.getId());
        channels.delete(channel);
    }

    /** Sends a sample message; any delivery error becomes 500 "Test failed: ..." like Node. */
    public void test(UUID organizationId, UUID id) {
        AlertChannel channel = get(organizationId, id);
        try {
            switch (channel.getType()) {
                case "webhook" -> {
                    Map<String, Object> monitor = new LinkedHashMap<>();
                    monitor.put("name", "Test Monitor");
                    monitor.put("url", "https://example.com");
                    monitor.put("status", "down");
                    Map<String, Object> payload = new LinkedHashMap<>();
                    payload.put("event", "test");
                    payload.put("monitor", monitor);
                    payload.put("timestamp", Instant.now());
                    payload.put("message", "This is a test alert from UptimeMonitor");
                    sender.post(channel.configString("url"), payload);
                }
                case "slack" -> sender.post(channel.configString("webhookUrl"), AlertPayloads.slackTest());
                case "discord" -> sender.post(channel.configString("webhookUrl"), AlertPayloads.discordTest());
                default -> {
                    // email: nothing to send (no mailer), reported as success like Node
                }
            }
        } catch (RuntimeException e) {
            throw new ApiException(500, "Test failed: " + e.getMessage());
        }
    }

    /** Latest 50 alert deliveries for the org, with "Monitor" and "AlertChannel" embedded. */
    public List<Map<String, Object>> logs(UUID organizationId) {
        Map<UUID, Monitor> byId = monitors.findByOrganizationId(organizationId).stream()
                .collect(Collectors.toMap(Monitor::getId, Function.identity()));
        if (byId.isEmpty()) {
            return List.of();
        }
        List<AlertLog> logs = alertLogs.findByMonitorIdInOrderBySentAtDesc(byId.keySet(), Limit.of(50));
        Map<UUID, AlertChannel> channelById = channels.findByIdIn(logs.stream().map(AlertLog::getChannelId).toList())
                .stream().collect(Collectors.toMap(AlertChannel::getId, Function.identity()));
        return logs.stream().map(log -> {
            Map<String, Object> m = json.toMap(log);
            Monitor monitor = byId.get(log.getMonitorId());
            m.put("Monitor", monitor == null ? null : Map.of("name", monitor.getName()));
            AlertChannel channel = channelById.get(log.getChannelId());
            m.put("AlertChannel", channel == null ? null : Map.of("name", channel.getName(), "type", channel.getType()));
            return m;
        }).toList();
    }

    private AlertChannel get(UUID organizationId, UUID id) {
        return channels.findByIdAndOrganizationId(id, organizationId)
                .orElseThrow(() -> ApiException.notFound("Alert channel not found"));
    }
}
