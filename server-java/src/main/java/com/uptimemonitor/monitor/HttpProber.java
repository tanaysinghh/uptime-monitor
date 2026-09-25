package com.uptimemonitor.monitor;

import com.uptimemonitor.domain.Monitor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.net.ConnectException;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpConnectTimeoutException;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.channels.UnresolvedAddressException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Performs one monitor request (the axios call in healthCheckService.js): configured
 * method, headers and body, redirects followed, any status accepted, raw body kept for
 * assertions. The timeout bounds the whole exchange including the body, like axios.
 */
@Component
public class HttpProber {

    /** Bodies beyond this are truncated; assertions only need a bounded prefix. */
    static final int MAX_BODY_BYTES = 5 * 1024 * 1024;

    private static final Set<String> RESTRICTED_HEADERS =
            Set.of("connection", "content-length", "expect", "host", "upgrade");

    public record Result(Integer statusCode, String body, String error, long elapsedMs) {
    }

    private final HttpClient client = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    private final JsonMapper mapper;

    public HttpProber(JsonMapper mapper) {
        this.mapper = mapper;
    }

    public Result probe(Monitor monitor) {
        int timeoutMs = monitor.getTimeoutMs() == null ? 30000 : monitor.getTimeoutMs();
        long started = System.nanoTime();
        try {
            HttpRequest request = buildRequest(monitor, timeoutMs);
            CompletableFuture<HttpResponse<InputStream>> future =
                    client.sendAsync(request, HttpResponse.BodyHandlers.ofInputStream());
            HttpResponse<InputStream> response;
            try {
                response = future.get(timeoutMs, TimeUnit.MILLISECONDS);
            } catch (TimeoutException e) {
                future.cancel(true);
                return timeout(monitor, started, timeoutMs);
            }
            long remaining = timeoutMs - elapsedMs(started);
            String body = readBody(response.body(), Math.max(1, remaining));
            if (body == null) {
                return timeout(monitor, started, timeoutMs);
            }
            return new Result(response.statusCode(), body, null, elapsedMs(started));
        } catch (ExecutionException e) {
            return new Result(null, null, describe(e.getCause(), monitor, timeoutMs), elapsedMs(started));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new Result(null, null, "Check interrupted", elapsedMs(started));
        } catch (RuntimeException e) {
            return new Result(null, null, describe(e, monitor, timeoutMs), elapsedMs(started));
        }
    }

    private HttpRequest buildRequest(Monitor monitor, int timeoutMs) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(monitor.getUrl()))
                .timeout(Duration.ofMillis(timeoutMs))
                .header("Accept", "application/json, text/plain, */*")
                .header("User-Agent", "UptimeMonitor/1.0");

        boolean hasContentType = false;
        Map<String, Object> headers = monitor.getHeaders();
        if (headers != null) {
            for (Map.Entry<String, Object> h : headers.entrySet()) {
                String name = h.getKey();
                if (name == null || h.getValue() == null || RESTRICTED_HEADERS.contains(name.toLowerCase(Locale.ROOT))) {
                    continue;
                }
                hasContentType |= name.equalsIgnoreCase("content-type");
                try {
                    builder.setHeader(name, String.valueOf(h.getValue()));
                } catch (IllegalArgumentException ignored) {
                    // header name/value the JDK refuses (e.g. control characters) - skip it
                }
            }
        }

        String method = monitor.getMethod() == null ? "GET" : monitor.getMethod();
        Object body = monitor.getBody();
        HttpRequest.BodyPublisher publisher = HttpRequest.BodyPublishers.noBody();
        if (body != null && !"HEAD".equals(method)) {
            String payload;
            String contentType;
            if (body instanceof String s) {
                payload = s;
                contentType = "application/x-www-form-urlencoded";
            } else {
                payload = mapper.writeValueAsString(body);
                contentType = "application/json";
            }
            if (!hasContentType) {
                builder.header("Content-Type", contentType);
            }
            publisher = HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8);
        }
        return builder.method(method, publisher).build();
    }

    /** Reads up to MAX_BODY_BYTES within the remaining time budget; null on timeout. */
    private static String readBody(InputStream in, long remainingMs) {
        CompletableFuture<String> read = CompletableFuture.supplyAsync(() -> {
            try (in) {
                return new String(in.readNBytes(MAX_BODY_BYTES), StandardCharsets.UTF_8);
            } catch (IOException e) {
                return "";
            }
        }, runnable -> Thread.ofVirtual().start(runnable));
        try {
            return read.get(remainingMs, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            closeQuietly(in);
            return null;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            closeQuietly(in);
            return null;
        } catch (ExecutionException e) {
            return "";
        }
    }

    private static void closeQuietly(InputStream in) {
        try {
            in.close();
        } catch (IOException ignored) {
            // nothing useful to do
        }
    }

    private Result timeout(Monitor monitor, long started, int timeoutMs) {
        return new Result(null, null, "Timeout after " + timeoutMs + "ms", elapsedMs(started));
    }

    /** Same wording as the Node error mapping (ECONNABORTED / ENOTFOUND / ECONNREFUSED). */
    static String describe(Throwable e, Monitor monitor, int timeoutMs) {
        if (e instanceof HttpConnectTimeoutException || e instanceof HttpTimeoutException) {
            return "Timeout after " + timeoutMs + "ms";
        }
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof UnknownHostException || t instanceof UnresolvedAddressException) {
                return "DNS lookup failed for " + monitor.getUrl();
            }
        }
        if (e instanceof ConnectException) {
            return "Connection refused by " + monitor.getUrl();
        }
        String message = e.getMessage();
        return message == null || message.isBlank() ? e.getClass().getSimpleName() : message;
    }

    private static long elapsedMs(long startedNanos) {
        return (System.nanoTime() - startedNanos) / 1_000_000;
    }
}
