package com.uptimemonitor.common;

import java.time.Duration;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Port of server/src/utils/parseDuration.js ("15m", "7d", "500" -> ms). */
public final class Durations {

    private static final Pattern PATTERN = Pattern.compile("^(\\d+)\\s*(ms|s|m|h|d)?$", Pattern.CASE_INSENSITIVE);

    private Durations() {
    }

    public static long parseMillis(String input) {
        if (input == null || input.isBlank()) {
            return 0;
        }
        Matcher m = PATTERN.matcher(input.trim());
        if (!m.matches()) {
            return 0;
        }
        long n = Long.parseLong(m.group(1));
        String unit = m.group(2) == null ? "ms" : m.group(2).toLowerCase(Locale.ROOT);
        return switch (unit) {
            case "s" -> n * 1_000L;
            case "m" -> n * 60_000L;
            case "h" -> n * 3_600_000L;
            case "d" -> n * 86_400_000L;
            default -> n;
        };
    }

    public static Duration parse(String input) {
        return Duration.ofMillis(parseMillis(input));
    }
}
