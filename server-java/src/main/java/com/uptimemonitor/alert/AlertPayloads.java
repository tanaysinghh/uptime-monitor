package com.uptimemonitor.alert;

import com.uptimemonitor.domain.Monitor;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Slack / Discord message bodies, identical to the ones built in alertService.js. */
final class AlertPayloads {

    /** Equivalent of JavaScript's new Date().toLocaleString() in en-US. */
    private static final DateTimeFormatter LOCALE_STRING =
            DateTimeFormatter.ofPattern("M/d/yyyy, h:mm:ss a", Locale.US);

    private AlertPayloads() {
    }

    static String now() {
        return LOCALE_STRING.format(Instant.now().atZone(ZoneId.systemDefault()));
    }

    static Map<String, Object> slack(Monitor monitor, String alertType) {
        boolean up = "up".equals(alertType);
        String color = up ? "#10b981" : "#ef4444";
        String emoji = up ? ":white_check_mark:" : ":red_circle:";
        String statusText = up ? "is back UP" : "is DOWN";
        return Map.of("attachments", List.of(Map.of(
                "color", color,
                "blocks", List.of(
                        Map.of("type", "section",
                                "text", Map.of("type", "mrkdwn",
                                        "text", emoji + " *" + monitor.getName() + "* " + statusText)),
                        Map.of("type", "section",
                                "fields", List.of(
                                        Map.of("type", "mrkdwn", "text", "*URL:*\n" + monitor.getUrl()),
                                        Map.of("type", "mrkdwn", "text", "*Time:*\n" + now())))))));
    }

    static Map<String, Object> discord(Monitor monitor, String alertType) {
        boolean up = "up".equals(alertType);
        int color = up ? 1111296 : 15548997;
        String statusText = up ? "is back UP" : "is DOWN";
        String emoji = up ? "✅" : "🔴";
        return Map.of("embeds", List.of(Map.of(
                "title", emoji + " " + monitor.getName() + " " + statusText,
                "color", color,
                "fields", List.of(
                        Map.of("name", "URL", "value", monitor.getUrl(), "inline", true),
                        Map.of("name", "Time", "value", now(), "inline", true)),
                "timestamp", Instant.now().toString())));
    }

    static Map<String, Object> slackTest() {
        return Map.of("text", ":test_tube: Test alert from UptimeMonitor - your alert channel is working!");
    }

    static Map<String, Object> discordTest() {
        return Map.of("content", "🧪 Test alert from UptimeMonitor - your alert channel is working!");
    }
}
