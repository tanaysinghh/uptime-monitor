package com.uptimemonitor.monitor;

import com.uptimemonitor.ratelimit.Limiter;
import com.uptimemonitor.ratelimit.RateLimited;
import com.uptimemonitor.security.AuthUser;
import com.uptimemonitor.security.RequireEditor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** /api/heartbeat: create heartbeat monitors (editors) and receive pings (public, token-keyed limit). */
@RestController
@RequestMapping("/api/heartbeat")
public class HeartbeatController {

    private final HeartbeatService heartbeats;

    public HeartbeatController(HeartbeatService heartbeats) {
        this.heartbeats = heartbeats;
    }

    @PostMapping("/monitors")
    @RequireEditor
    ResponseEntity<Map<String, Object>> create(@AuthenticationPrincipal AuthUser user,
                                               @RequestBody(required = false) Map<String, Object> body) {
        return ResponseEntity.status(201).body(heartbeats.create(user.organizationId(), body));
    }

    @RequestMapping(value = "/{token}", method = {RequestMethod.GET, RequestMethod.POST})
    @RateLimited(Limiter.HEARTBEAT)
    Map<String, Object> ping(@PathVariable String token) {
        return heartbeats.receive(token);
    }
}
