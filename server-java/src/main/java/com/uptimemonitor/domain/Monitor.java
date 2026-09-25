package com.uptimemonitor.domain;

import com.uptimemonitor.common.Times;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "Monitors")
@DynamicUpdate
public class Monitor extends BaseEntity {

    private String name;
    private String url;
    @Column(columnDefinition = "\"enum_Monitors_method\"")
    private String method = "GET";
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> headers = new LinkedHashMap<>();
    @JdbcTypeCode(SqlTypes.JSON)
    private Object body;
    private Integer intervalSeconds = 300;
    private Integer timeoutMs = 30000;
    private Integer expectedStatus = 200;
    @Column(columnDefinition = "\"enum_Monitors_status\"")
    private String status = "pending";
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(columnDefinition = "varchar(255)[]")
    private List<String> tags = new ArrayList<>();
    private Integer consecutiveFailures = 0;
    private Instant lastCheckedAt;
    private UUID organizationId;
    private Instant createdAt;
    private Instant updatedAt;
    @JdbcTypeCode(SqlTypes.JSON)
    private List<Map<String, Object>> assertions = new ArrayList<>();
    @Column(columnDefinition = "\"enum_Monitors_monitorType\"")
    private String monitorType = "http";
    private Integer heartbeatInterval;
    private String heartbeatToken;
    private Instant lastHeartbeatAt;
    private Boolean maintenanceMode = false;
    private Instant maintenanceStartAt;
    private Instant maintenanceEndAt;
    private String maintenanceReason;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = Times.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Times.now();
    }

    public boolean inMaintenance() {
        return Boolean.TRUE.equals(maintenanceMode);
    }

    public int consecutiveFailureCount() {
        return consecutiveFailures == null ? 0 : consecutiveFailures;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }
    public Map<String, Object> getHeaders() { return headers; }
    public void setHeaders(Map<String, Object> headers) { this.headers = headers; }
    public Object getBody() { return body; }
    public void setBody(Object body) { this.body = body; }
    public Integer getIntervalSeconds() { return intervalSeconds; }
    public void setIntervalSeconds(Integer intervalSeconds) { this.intervalSeconds = intervalSeconds; }
    public Integer getTimeoutMs() { return timeoutMs; }
    public void setTimeoutMs(Integer timeoutMs) { this.timeoutMs = timeoutMs; }
    public Integer getExpectedStatus() { return expectedStatus; }
    public void setExpectedStatus(Integer expectedStatus) { this.expectedStatus = expectedStatus; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
    public Integer getConsecutiveFailures() { return consecutiveFailures; }
    public void setConsecutiveFailures(Integer consecutiveFailures) { this.consecutiveFailures = consecutiveFailures; }
    public Instant getLastCheckedAt() { return lastCheckedAt; }
    public void setLastCheckedAt(Instant lastCheckedAt) { this.lastCheckedAt = lastCheckedAt; }
    public UUID getOrganizationId() { return organizationId; }
    public void setOrganizationId(UUID organizationId) { this.organizationId = organizationId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public List<Map<String, Object>> getAssertions() { return assertions; }
    public void setAssertions(List<Map<String, Object>> assertions) { this.assertions = assertions; }
    public String getMonitorType() { return monitorType; }
    public void setMonitorType(String monitorType) { this.monitorType = monitorType; }
    public Integer getHeartbeatInterval() { return heartbeatInterval; }
    public void setHeartbeatInterval(Integer heartbeatInterval) { this.heartbeatInterval = heartbeatInterval; }
    public String getHeartbeatToken() { return heartbeatToken; }
    public void setHeartbeatToken(String heartbeatToken) { this.heartbeatToken = heartbeatToken; }
    public Instant getLastHeartbeatAt() { return lastHeartbeatAt; }
    public void setLastHeartbeatAt(Instant lastHeartbeatAt) { this.lastHeartbeatAt = lastHeartbeatAt; }
    public Boolean getMaintenanceMode() { return maintenanceMode; }
    public void setMaintenanceMode(Boolean maintenanceMode) { this.maintenanceMode = maintenanceMode; }
    public Instant getMaintenanceStartAt() { return maintenanceStartAt; }
    public void setMaintenanceStartAt(Instant maintenanceStartAt) { this.maintenanceStartAt = maintenanceStartAt; }
    public Instant getMaintenanceEndAt() { return maintenanceEndAt; }
    public void setMaintenanceEndAt(Instant maintenanceEndAt) { this.maintenanceEndAt = maintenanceEndAt; }
    public String getMaintenanceReason() { return maintenanceReason; }
    public void setMaintenanceReason(String maintenanceReason) { this.maintenanceReason = maintenanceReason; }
}
