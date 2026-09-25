package com.uptimemonitor.alert;

import com.uptimemonitor.common.RequestValidator;
import com.uptimemonitor.security.AuthUser;
import com.uptimemonitor.security.RequireEditor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/alerts")
public class AlertController {

    private final AlertChannelService channels;

    public AlertController(AlertChannelService channels) {
        this.channels = channels;
    }

    @GetMapping("/channels")
    Map<String, Object> list(@AuthenticationPrincipal AuthUser user) {
        return Map.of("channels", channels.list(user.organizationId()));
    }

    @GetMapping("/logs")
    Map<String, Object> logs(@AuthenticationPrincipal AuthUser user) {
        return Map.of("logs", channels.logs(user.organizationId()));
    }

    @PostMapping("/channels")
    @RequireEditor
    ResponseEntity<Map<String, Object>> create(@AuthenticationPrincipal AuthUser user,
                                               @RequestBody(required = false) Map<String, Object> body) {
        return ResponseEntity.status(201).body(Map.of("channel", channels.create(user.organizationId(), body)));
    }

    @PutMapping("/channels/{id}")
    @RequireEditor
    Map<String, Object> update(@AuthenticationPrincipal AuthUser user, @PathVariable String id,
                               @RequestBody(required = false) Map<String, Object> body) {
        return Map.of("channel", channels.update(user.organizationId(), RequestValidator.uuidParam("id", id), body));
    }

    @DeleteMapping("/channels/{id}")
    @RequireEditor
    Map<String, Object> delete(@AuthenticationPrincipal AuthUser user, @PathVariable String id) {
        channels.delete(user.organizationId(), RequestValidator.uuidParam("id", id));
        return Map.of("message", "Alert channel deleted");
    }

    @PostMapping("/channels/{id}/test")
    @RequireEditor
    Map<String, Object> test(@AuthenticationPrincipal AuthUser user, @PathVariable String id) {
        channels.test(user.organizationId(), RequestValidator.uuidParam("id", id));
        return Map.of("message", "Test alert sent successfully");
    }
}
