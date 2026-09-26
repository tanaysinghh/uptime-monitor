package com.uptimemonitor.monitor;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;

/**
 * Keeps hosts that sleep when idle (Render free instances stop after 15 minutes without
 * inbound traffic, and with them the check scheduler) awake by requesting the given
 * URLs through their public address every 10 minutes. Off unless KEEPALIVE_URLS is set.
 */
@Component
@EnableScheduling
@ConditionalOnExpression("'${KEEPALIVE_URLS:}' != ''")
public class KeepAlive {

    private static final Logger log = LoggerFactory.getLogger(KeepAlive.class);

    private final List<URI> urls;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20)).build();

    public KeepAlive(@Value("${KEEPALIVE_URLS}") String urls) {
        this.urls = Arrays.stream(urls.split(",")).map(String::trim).filter(s -> !s.isEmpty()).map(URI::create).toList();
        log.info("Keep-alive pinging {} URL(s) every 10 minutes", this.urls.size());
    }

    @Scheduled(fixedDelay = 600_000, initialDelay = 60_000)
    void ping() {
        for (URI url : urls) {
            try {
                HttpResponse<Void> r = http.send(HttpRequest.newBuilder(url).timeout(Duration.ofSeconds(90)).GET().build(),
                        HttpResponse.BodyHandlers.discarding());
                log.debug("Keep-alive {} -> {}", url, r.statusCode());
            } catch (Exception e) {
                log.warn("Keep-alive {} failed: {}", url, e.getMessage());
            }
        }
    }

    List<URI> urls() {
        return urls;
    }
}
