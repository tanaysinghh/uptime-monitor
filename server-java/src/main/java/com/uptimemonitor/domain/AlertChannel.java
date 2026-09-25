package com.uptimemonitor.domain;

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
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "AlertChannels")
public class AlertChannel extends BaseEntity {

    private UUID organizationId;
    private String name;
    @Column(columnDefinition = "\"enum_AlertChannels_type\"")
    private String type;
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> config;
    private Boolean isActive = true;
    private Integer cooldownMinutes = 5;
    private Instant lastAlertedAt;
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

    public String configString(String key) {
        Object v = config == null ? null : config.get(key);
        return v == null ? null : String.valueOf(v);
    }

    public UUID getOrganizationId() { return organizationId; }
    public void setOrganizationId(UUID organizationId) { this.organizationId = organizationId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public Map<String, Object> getConfig() { return config; }
    public void setConfig(Map<String, Object> config) { this.config = config; }
    @JsonProperty("isActive")
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean active) { isActive = active; }
    public Integer getCooldownMinutes() { return cooldownMinutes; }
    public void setCooldownMinutes(Integer cooldownMinutes) { this.cooldownMinutes = cooldownMinutes; }
    public Instant getLastAlertedAt() { return lastAlertedAt; }
    public void setLastAlertedAt(Instant lastAlertedAt) { this.lastAlertedAt = lastAlertedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
