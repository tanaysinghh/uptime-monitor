package com.uptimemonitor.apikey;

import com.uptimemonitor.common.ApiException;
import com.uptimemonitor.common.RequestValidator;
import com.uptimemonitor.domain.ApiKey;
import com.uptimemonitor.repository.ApiKeyRepository;
import com.uptimemonitor.security.AuthUser;
import com.uptimemonitor.team.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Port of controllers/apiKeyController.js. Keys are "um_" + 64 hex chars; only the SHA-256
 * and a 10-char prefix are stored, and the plaintext is returned once at creation.
 */
@RestController
@RequestMapping("/api/api-keys")
public class ApiKeyController {

    private final ApiKeyRepository apiKeys;
    private final AuditLogService audit;

    public ApiKeyController(ApiKeyRepository apiKeys, AuditLogService audit) {
        this.apiKeys = apiKeys;
        this.audit = audit;
    }

    @GetMapping
    Map<String, Object> list(@AuthenticationPrincipal AuthUser user) {
        return Map.of("keys", apiKeys.findByOrganizationIdOrderByCreatedAtDesc(user.organizationId()));
    }

    @PostMapping
    ResponseEntity<Map<String, Object>> create(@AuthenticationPrincipal AuthUser user,
                                               @RequestBody(required = false) Map<String, Object> body,
                                               HttpServletRequest request) {
        RequestValidator v = RequestValidator.of(body);
        String name = v.string("name", 1, 200, true, null);
        List<?> permissions = v.optionalArray("permissions");
        Instant expiresAt = v.optionalIso8601("expiresAt", true);
        v.validate();

        if (!user.isAdmin()) {
            throw ApiException.forbidden("Only admins can create API keys");
        }
        List<String> perms = new ArrayList<>();
        if (permissions != null) {
            permissions.forEach(p -> perms.add(String.valueOf(p)));
        } else {
            perms.add("read");
        }

        ApiKey.Generated generated = ApiKey.generateKey();
        ApiKey key = new ApiKey();
        key.setOrganizationId(user.organizationId());
        key.setUserId(user.id());
        key.setName(name);
        key.setKeyHash(generated.hash());
        key.setKeyPrefix(generated.prefix());
        key.setPermissions(perms);
        key.setExpiresAt(expiresAt);
        apiKeys.save(key);

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("name", name);
        details.put("permissions", perms);
        audit.record(user, "create_api_key", "api_key", key.getId(), details, request);

        Map<String, Object> apiKey = new LinkedHashMap<>();
        apiKey.put("id", key.getId());
        apiKey.put("name", key.getName());
        apiKey.put("keyPrefix", key.getKeyPrefix());
        apiKey.put("permissions", key.getPermissions());
        apiKey.put("expiresAt", key.getExpiresAt());
        apiKey.put("createdAt", key.getCreatedAt());
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("apiKey", apiKey);
        response.put("key", generated.key());
        return ResponseEntity.status(201).body(response);
    }

    @PutMapping("/{id}/revoke")
    Map<String, Object> revoke(@AuthenticationPrincipal AuthUser user, @PathVariable String id,
                               HttpServletRequest request) {
        UUID keyId = RequestValidator.uuidParam("id", id);
        if (!user.isAdmin()) {
            throw ApiException.forbidden("Only admins can revoke API keys");
        }
        ApiKey key = apiKeys.findByIdAndOrganizationId(keyId, user.organizationId())
                .orElseThrow(() -> ApiException.notFound("API key not found"));
        key.setIsActive(false);
        apiKeys.save(key);
        audit.record(user, "revoke_api_key", "api_key", key.getId(), Map.of("name", key.getName()), request);
        return Map.of("message", "API key revoked");
    }
}
