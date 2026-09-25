package com.uptimemonitor.domain;

import com.uptimemonitor.common.Times;
import jakarta.persistence.Entity;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** Single-use record backing an mfaChallengeToken issued after a correct password. */
@Entity
@Table(name = "MfaChallenges")
public class MfaChallenge extends BaseEntity {

    private UUID userId;
    private Instant usedAt;
    private Instant expiresAt;
    private String ipAddress;
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Times.now();
    }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public Instant getUsedAt() { return usedAt; }
    public void setUsedAt(Instant usedAt) { this.usedAt = usedAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    public Instant getCreatedAt() { return createdAt; }
}
