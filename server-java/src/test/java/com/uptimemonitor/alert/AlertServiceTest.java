package com.uptimemonitor.alert;

import com.uptimemonitor.domain.AlertChannel;
import com.uptimemonitor.domain.AlertLog;
import com.uptimemonitor.domain.Incident;
import com.uptimemonitor.domain.Monitor;
import com.uptimemonitor.repository.AlertChannelRepository;
import com.uptimemonitor.repository.AlertLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Unit tests (Mockito) for alert fan-out, cooldowns and delivery logging. */
@ExtendWith(MockitoExtension.class)
class AlertServiceTest {

    @Mock
    AlertChannelRepository channels;
    @Mock
    AlertLogRepository alertLogs;
    @Mock
    WebhookSender sender;
    @Mock
    ExecutorService executor;

    AlertService service;
    Monitor monitor;
    Incident incident;

    @BeforeEach
    void setUp() {
        service = new AlertService(channels, alertLogs, sender, executor);
        monitor = new Monitor();
        monitor.setName("API");
        monitor.setUrl("https://api.example.com");
        monitor.setStatus("down");
        monitor.setOrganizationId(UUID.randomUUID());
        incident = new Incident();
        incident.setStartedAt(Instant.now());
    }

    private static AlertChannel channel(String type, Map<String, Object> config, Instant lastAlertedAt) {
        AlertChannel c = new AlertChannel();
        c.setType(type);
        c.setName(type);
        c.setConfig(config);
        c.setLastAlertedAt(lastAlertedAt);
        return c;
    }

    @Test
    void deliversToEveryChannelTypeAndLogsSent() {
        AlertChannel webhook = channel("webhook", Map.of("url", "https://hooks.example.com/x"), null);
        AlertChannel slack = channel("slack", Map.of("webhookUrl", "https://hooks.slack.com/x"), null);
        AlertChannel discord = channel("discord", Map.of("webhookUrl", "https://discord.com/api/webhooks/x"), null);
        AlertChannel email = channel("email", Map.of("to", "ops@example.com"), null);
        when(channels.findByOrganizationIdAndIsActiveTrue(monitor.getOrganizationId()))
                .thenReturn(List.of(webhook, slack, discord, email));

        service.sendAlert(monitor, incident, "down");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> webhookPayload = ArgumentCaptor.forClass(Map.class);
        verify(sender).post(eq("https://hooks.example.com/x"), webhookPayload.capture());
        assertThat(webhookPayload.getValue()).containsEntry("event", "down").containsKeys("monitor", "incident", "timestamp");
        verify(sender).post(eq("https://hooks.slack.com/x"), any());
        verify(sender).post(eq("https://discord.com/api/webhooks/x"), any());

        ArgumentCaptor<AlertLog> logs = ArgumentCaptor.forClass(AlertLog.class);
        verify(alertLogs, times(4)).save(logs.capture());
        assertThat(logs.getAllValues()).allSatisfy(l -> {
            assertThat(l.getStatus()).isEqualTo("sent");
            assertThat(l.getType()).isEqualTo("down");
            assertThat(l.getIncidentId()).isEqualTo(incident.getId());
        });
        assertThat(webhook.getLastAlertedAt()).isNotNull();
    }

    @Test
    void respectsChannelCooldown() {
        AlertChannel recent = channel("webhook", Map.of("url", "https://hooks.example.com/x"),
                Instant.now().minusSeconds(60)); // default cooldown is 5 minutes
        when(channels.findByOrganizationIdAndIsActiveTrue(any())).thenReturn(List.of(recent));

        service.sendAlert(monitor, incident, "down");

        verify(sender, never()).post(anyString(), any());
        verify(alertLogs, never()).save(any());
    }

    @Test
    void logsFailuresWithTheErrorMessage() {
        AlertChannel webhook = channel("webhook", Map.of("url", "https://hooks.example.com/x"), null);
        when(channels.findByOrganizationIdAndIsActiveTrue(any())).thenReturn(List.of(webhook));
        doThrow(new IllegalStateException("Request failed with status code 500")).when(sender).post(anyString(), any());

        service.sendAlert(monitor, incident, "up");

        ArgumentCaptor<AlertLog> log = ArgumentCaptor.forClass(AlertLog.class);
        verify(alertLogs).save(log.capture());
        assertThat(log.getValue().getStatus()).isEqualTo("failed");
        assertThat(log.getValue().getErrorMessage()).isEqualTo("Request failed with status code 500");
        assertThat(webhook.getLastAlertedAt()).isNull();
    }

    @Test
    void asyncVariantHandsOffToTheExecutor() {
        service.sendAlertAsync(monitor, incident, "down");
        verify(executor).execute(any());
    }

    @Test
    void slackAndDiscordPayloadsMatchNode() {
        Map<String, Object> slack = AlertPayloads.slack(monitor, "up");
        assertThat(slack.toString()).contains(":white_check_mark: *API* is back UP", "#10b981", "*URL:*\nhttps://api.example.com");
        Map<String, Object> discord = AlertPayloads.discord(monitor, "down");
        assertThat(discord.toString()).contains("🔴 API is DOWN", "15548997");
    }
}
