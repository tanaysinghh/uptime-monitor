package com.uptimemonitor.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.uptimemonitor.common.Times;
import jakarta.persistence.Entity;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** A revocable login session; the refresh token itself is stored only as a SHA-256 hash. */
@Entity
@Table(name = "Sessions")
public class Session extends BaseEntity {

    private UUID userId;
    @JsonIgnore
    private String refreshTokenHash;
    private String userAgent;
    private String ipAddress;
    private Instant lastUsedAt;
    private Instant expiresAt;
    private Instant revokedAt;
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Times.now();
    }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public String getRefreshTokenHash() { return refreshTokenHash; }
    public void setRefreshTokenHash(String refreshTokenHash) { this.refreshTokenHash = refreshTokenHash; }
    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    public Instant getLastUsedAt() { return lastUsedAt; }
    public void setLastUsedAt(Instant lastUsedAt) { this.lastUsedAt = lastUsedAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public void setRevokedAt(Instant revokedAt) { this.revokedAt = revokedAt; }
    public Instant getCreatedAt() { return createdAt; }
}
