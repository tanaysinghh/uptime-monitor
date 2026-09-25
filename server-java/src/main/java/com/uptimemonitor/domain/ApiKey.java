package com.uptimemonitor.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.uptimemonitor.common.Crypto;
import com.uptimemonitor.common.Times;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "ApiKeys")
public class ApiKey extends BaseEntity {

    /** A freshly minted key: the plaintext is shown to the user exactly once. */
    public record Generated(String key, String hash, String prefix) {
    }

    private UUID organizationId;
    private UUID userId;
    private String name;
    @JsonIgnore
    private String keyHash;
    private String keyPrefix;
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(columnDefinition = "varchar(255)[]")
    private List<String> permissions = new ArrayList<>(List.of("read"));
    private Instant lastUsedAt;
    private Instant expiresAt;
    private Boolean isActive = true;
    private Instant createdAt;
    private Instant updatedAt;

    /** Same format as the Node model: "um_" + 64 hex chars, SHA-256 stored, 10-char prefix. */
    public static Generated generateKey() {
        String key = "um_" + Crypto.randomHex(32);
        return new Generated(key, Crypto.sha256Hex(key), key.substring(0, 10));
    }

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = Times.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Times.now();
    }

    public UUID getOrganizationId() { return organizationId; }
    public void setOrganizationId(UUID organizationId) { this.organizationId = organizationId; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getKeyHash() { return keyHash; }
    public void setKeyHash(String keyHash) { this.keyHash = keyHash; }
    public String getKeyPrefix() { return keyPrefix; }
    public void setKeyPrefix(String keyPrefix) { this.keyPrefix = keyPrefix; }
    public List<String> getPermissions() { return permissions; }
    public void setPermissions(List<String> permissions) { this.permissions = permissions; }
    public Instant getLastUsedAt() { return lastUsedAt; }
    public void setLastUsedAt(Instant lastUsedAt) { this.lastUsedAt = lastUsedAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    @JsonProperty("isActive")
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean active) { isActive = active; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
