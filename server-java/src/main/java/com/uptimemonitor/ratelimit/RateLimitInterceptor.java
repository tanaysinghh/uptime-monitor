package com.uptimemonitor.ratelimit;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.uptimemonitor.common.Http;
import com.uptimemonitor.config.AppProperties;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;
import tools.jackson.databind.json.JsonMapper;

import java.util.EnumMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Bucket4j implementation of the express-rate-limit limiters. Each limiter is a fixed
 * window (capacity refilled all at once per window) per client IP - or per heartbeat
 * token - and emits the IETF draft-7 RateLimit / RateLimit-Policy headers like the Node
 * server. Buckets live in an expiring Caffeine cache so idle clients don't leak memory.
 *
 * <p>In-memory state is per process, exactly like express-rate-limit's default store.
 */
@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    private final boolean enabled;
    private final JsonMapper mapper;
    private final Map<Limiter, Cache<String, Bucket>> buckets = new EnumMap<>(Limiter.class);

    public RateLimitInterceptor(AppProperties props, JsonMapper mapper) {
        this.enabled = props.rateLimit().enabled();
        this.mapper = mapper;
        for (Limiter limiter : Limiter.values()) {
            buckets.put(limiter, Caffeine.newBuilder()
                    .expireAfterAccess(limiter.window().multipliedBy(2))
                    .maximumSize(100_000)
                    .build());
        }
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        if (!enabled || !(handler instanceof HandlerMethod method)) {
            return true;
        }
        RateLimited annotation = method.getMethodAnnotation(RateLimited.class);
        if (annotation == null) {
            return true;
        }
        Limiter limiter = annotation.value();
        String key = keyFor(limiter, request);
        Bucket bucket = buckets.get(limiter).get(key, k -> newBucket(limiter));
        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);

        long windowSeconds = limiter.window().toSeconds();
        long resetSeconds = probe.isConsumed()
                ? Math.max(1, TimeUnit.NANOSECONDS.toSeconds(probe.getNanosToWaitForReset()))
                : Math.max(1, (long) Math.ceil(probe.getNanosToWaitForRefill() / 1e9));
        response.setHeader("RateLimit-Policy", limiter.limit() + ";w=" + windowSeconds);
        response.setHeader("RateLimit", "limit=" + limiter.limit() + ", remaining="
                + probe.getRemainingTokens() + ", reset=" + resetSeconds);

        if (probe.isConsumed()) {
            return true;
        }
        response.setHeader("Retry-After", String.valueOf(resetSeconds));
        response.setStatus(429);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        mapper.writeValue(response.getOutputStream(), Map.of("error", limiter.message()));
        return false;
    }

    private static Bucket newBucket(Limiter limiter) {
        return Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(limiter.limit())
                        .refillIntervally(limiter.limit(), limiter.window())
                        .build())
                .build();
    }

    @SuppressWarnings("unchecked")
    private static String keyFor(Limiter limiter, HttpServletRequest request) {
        if (limiter == Limiter.HEARTBEAT) {
            Object vars = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
            if (vars instanceof Map<?, ?> map && map.get("token") != null) {
                return "token:" + ((Map<String, String>) map).get("token");
            }
        }
        return "ip:" + Http.clientIp(request);
    }
}
