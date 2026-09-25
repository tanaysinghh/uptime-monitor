package com.uptimemonitor.publicapi;

import com.uptimemonitor.common.ApiException;
import com.uptimemonitor.common.Crypto;
import com.uptimemonitor.common.RequestValidator;
import com.uptimemonitor.domain.Monitor;
import com.uptimemonitor.domain.Organization;
import com.uptimemonitor.domain.Subscriber;
import com.uptimemonitor.ratelimit.Limiter;
import com.uptimemonitor.ratelimit.RateLimited;
import com.uptimemonitor.repository.SubscriberRepository;
import com.uptimemonitor.security.AuthUser;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * /api/public: the unauthenticated status page, SVG badges and subscriber sign-up
 * (publicController, badgeController and subscriberController in Node), plus the
 * authenticated subscriber list.
 */
@RestController
@RequestMapping("/api/public")
public class PublicController {

    private final PublicStatusService status;
    private final SubscriberRepository subscribers;

    public PublicController(PublicStatusService status, SubscriberRepository subscribers) {
        this.status = status;
        this.subscribers = subscribers;
    }

    @GetMapping("/status/{slug}")
    @RateLimited(Limiter.PUBLIC)
    Map<String, Object> statusPage(@PathVariable String slug) {
        return status.statusPage(slug);
    }

    @GetMapping("/status/{slug}/badge.svg")
    @RateLimited(Limiter.PUBLIC)
    ResponseEntity<String> statusBadge(@PathVariable String slug) {
        Optional<Organization> org = status.organization(slug);
        if (org.isEmpty()) {
            return svg(BadgeRenderer.render("status", "not found", BadgeRenderer.UNKNOWN));
        }
        List<Monitor> monitors = status.visibleMonitors(org.get());
        if (monitors.isEmpty()) {
            return svg(BadgeRenderer.render("status", "no monitors", BadgeRenderer.UNKNOWN));
        }
        boolean allUp = monitors.stream().allMatch(m -> "up".equals(m.getStatus()));
        boolean allDown = monitors.stream().allMatch(m -> "down".equals(m.getStatus()));
        String label = allDown ? "major outage" : allUp ? "operational" : "partial outage";
        return svg(BadgeRenderer.render("status", label, allUp ? BadgeRenderer.UP : BadgeRenderer.DOWN));
    }

    @GetMapping("/status/{slug}/uptime.svg")
    @RateLimited(Limiter.PUBLIC)
    ResponseEntity<String> uptimeBadge(@PathVariable String slug, @RequestParam(required = false) String period) {
        int days = "7d".equals(period) ? 7 : "30d".equals(period) ? 30 : 90;
        Optional<Organization> org = status.organization(slug);
        if (org.isEmpty()) {
            return svg(BadgeRenderer.render("uptime", "not found", BadgeRenderer.UNKNOWN));
        }
        List<UUID> ids = status.visibleMonitors(org.get()).stream().map(Monitor::getId).toList();
        if (ids.isEmpty()) {
            return svg(BadgeRenderer.render("uptime", "n/a", BadgeRenderer.UNKNOWN));
        }
        PublicStatusService.Uptime uptime = status.uptime(ids, Duration.ofDays(days));
        String label = "uptime " + days + "d";
        if (uptime.total() == 0) {
            return svg(BadgeRenderer.render(label, "n/a", BadgeRenderer.UNKNOWN));
        }
        double pct = uptime.successful() * 100.0 / uptime.total();
        String value = pct >= 99.99 ? "100%" : String.format(java.util.Locale.ROOT, "%.2f%%", pct);
        String color = pct < 95 ? BadgeRenderer.DOWN : pct < 99 ? BadgeRenderer.WARN : BadgeRenderer.UP;
        return svg(BadgeRenderer.render(label, value, color));
    }

    private static ResponseEntity<String> svg(String body) {
        return ResponseEntity.ok()
                .header("Content-Type", "image/svg+xml; charset=utf-8")
                .header("Cache-Control", "public, max-age=60, s-maxage=60")
                .body(body);
    }

    // ---- subscribers ---------------------------------------------------------------

    @PostMapping("/status/{slug}/subscribe")
    @RateLimited(Limiter.SUBSCRIBE)
    ResponseEntity<Map<String, Object>> subscribe(@PathVariable String slug,
                                                  @RequestBody(required = false) Map<String, Object> body) {
        RequestValidator v = RequestValidator.of(body);
        String email = v.email("email", null);
        v.validate();

        Organization org = status.organization(slug)
                .orElseThrow(() -> ApiException.notFound("Status page not found"));
        if (subscribers.findByOrganizationIdAndEmail(org.getId(), email).isPresent()) {
            throw ApiException.badRequest("Already subscribed");
        }
        Subscriber s = new Subscriber();
        s.setOrganizationId(org.getId());
        s.setEmail(email);
        s.setConfirmToken(Crypto.randomHex(32));
        s.setConfirmed(true);
        subscribers.save(s);
        return ResponseEntity.status(201).body(Map.of("message", "Subscribed successfully"));
    }

    @GetMapping("/unsubscribe/{token}")
    Map<String, Object> unsubscribe(@PathVariable String token) {
        Subscriber s = subscribers.findByConfirmToken(token)
                .orElseThrow(() -> ApiException.notFound("Subscriber not found"));
        subscribers.delete(s);
        return Map.of("message", "Unsubscribed successfully");
    }

    @GetMapping("/subscribers")
    Map<String, Object> list(@AuthenticationPrincipal AuthUser user) {
        return Map.of("subscribers", subscribers.findByOrganizationIdOrderByCreatedAtDesc(user.organizationId()));
    }
}
