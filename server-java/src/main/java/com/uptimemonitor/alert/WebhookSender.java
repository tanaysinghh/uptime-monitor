package com.uptimemonitor.alert;

import com.uptimemonitor.security.SsrfGuard;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * POSTs JSON to an alert channel endpoint (10s timeout, non-2xx is a failure - axios
 * semantics). Destinations go through the SSRF guard: the Node server posted to any
 * user-supplied URL, which let a channel probe internal services.
 */
@Component
public class WebhookSender {

    private final HttpClient client = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .followRedirects(HttpClient.Redirect.NEVER)
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private final JsonMapper mapper;
    private final SsrfGuard ssrfGuard;

    public WebhookSender(JsonMapper mapper, SsrfGuard ssrfGuard) {
        this.mapper = mapper;
        this.ssrfGuard = ssrfGuard;
    }

    public void post(String url, Object payload) {
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("Channel has no URL configured");
        }
        SsrfGuard.Result guard = ssrfGuard.validateMonitorUrl(url);
        if (!guard.ok()) {
            throw new IllegalArgumentException(guard.reason());
        }
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload)))
                .build();
        try {
            HttpResponse<Void> response = client.send(request, HttpResponse.BodyHandlers.discarding());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("Request failed with status code " + response.statusCode());
            }
        } catch (IOException e) {
            throw new IllegalStateException(e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted", e);
        }
    }
}
