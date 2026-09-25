package com.uptimemonitor.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
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

/**
 * Secrets (password hash, MFA secret, backup-code hashes) are never serialized.
 * The Node team endpoint leaked mfaSecret/mfaBackupCodes because it only excluded
 * "password"; here they are excluded everywhere.
 */
@Entity
@Table(name = "Users")
public class User extends BaseEntity {

    private String email;
    @JsonIgnore
    private String password;
    private String name;
    @Column(columnDefinition = "\"enum_Users_role\"")
    private String role = "admin";
    private boolean isVerified;
    private UUID organizationId;
    private int failedLoginAttempts;
    private Instant lockedUntil;
    private Instant passwordChangedAt;
    private boolean mfaEnabled;
    @JsonIgnore
    private String mfaSecret;
    @JsonIgnore
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(columnDefinition = "varchar(255)[]")
    private List<String> mfaBackupCodes = new ArrayList<>();
    private Instant mfaConfirmedAt;
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = Times.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Times.now();
    }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    @JsonProperty("isVerified")
    public boolean getIsVerified() { return isVerified; }
    public void setIsVerified(boolean verified) { isVerified = verified; }
    public UUID getOrganizationId() { return organizationId; }
    public void setOrganizationId(UUID organizationId) { this.organizationId = organizationId; }
    public int getFailedLoginAttempts() { return failedLoginAttempts; }
    public void setFailedLoginAttempts(int failedLoginAttempts) { this.failedLoginAttempts = failedLoginAttempts; }
    public Instant getLockedUntil() { return lockedUntil; }
    public void setLockedUntil(Instant lockedUntil) { this.lockedUntil = lockedUntil; }
    public Instant getPasswordChangedAt() { return passwordChangedAt; }
    public void setPasswordChangedAt(Instant passwordChangedAt) { this.passwordChangedAt = passwordChangedAt; }
    public boolean isMfaEnabled() { return mfaEnabled; }
    public void setMfaEnabled(boolean mfaEnabled) { this.mfaEnabled = mfaEnabled; }
    public String getMfaSecret() { return mfaSecret; }
    public void setMfaSecret(String mfaSecret) { this.mfaSecret = mfaSecret; }
    public List<String> getMfaBackupCodes() { return mfaBackupCodes == null ? new ArrayList<>() : mfaBackupCodes; }
    public void setMfaBackupCodes(List<String> mfaBackupCodes) { this.mfaBackupCodes = new ArrayList<>(mfaBackupCodes); }
    public Instant getMfaConfirmedAt() { return mfaConfirmedAt; }
    public void setMfaConfirmedAt(Instant mfaConfirmedAt) { this.mfaConfirmedAt = mfaConfirmedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
