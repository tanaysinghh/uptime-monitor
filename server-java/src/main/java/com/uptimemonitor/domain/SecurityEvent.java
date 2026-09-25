package com.uptimemonitor.domain;

import com.uptimemonitor.common.Times;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "SecurityEvents")
public class SecurityEvent extends BaseEntity {

    public static final String LOGIN_SUCCESS = "login_success";
    public static final String LOGIN_FAILURE = "login_failure";
    public static final String ACCOUNT_LOCKED = "account_locked";
    public static final String MFA_ENABLED = "mfa_enabled";
    public static final String MFA_DISABLED = "mfa_disabled";
    public static final String MFA_CHALLENGE_SUCCESS = "mfa_challenge_success";
    public static final String MFA_CHALLENGE_FAILURE = "mfa_challenge_failure";
    public static final String BACKUP_CODE_USED = "backup_code_used";
    public static final String BACKUP_CODES_REGENERATED = "backup_codes_regenerated";
    public static final String PASSWORD_CHANGED = "password_changed";
    public static final String SESSION_REVOKED = "session_revoked";
    public static final String SESSIONS_REVOKED_ALL = "sessions_revoked_all";

    private UUID userId;
    private UUID organizationId;
    @Column(columnDefinition = "\"enum_SecurityEvents_eventType\"")
    private String eventType;
    private String ipAddress;
    private String userAgent;
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> metadata = new LinkedHashMap<>();
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Times.now();
    }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public UUID getOrganizationId() { return organizationId; }
    public void setOrganizationId(UUID organizationId) { this.organizationId = organizationId; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }
    public Map<String, Object> getMetadata() { return metadata; }
    public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata; }
    public Instant getCreatedAt() { return createdAt; }
}
