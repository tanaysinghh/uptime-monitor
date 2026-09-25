package com.uptimemonitor.domain;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.uptimemonitor.common.Times;
import jakarta.persistence.Entity;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "Checks")
public class Check extends BaseEntity {

    private UUID monitorId;
    private Integer statusCode;
    private Integer responseTimeMs;
    private boolean isSuccess;
    private String errorMessage;
    private Instant checkedAt;

    @PrePersist
    void onCreate() {
        if (checkedAt == null) {
            checkedAt = Times.now();
        }
    }

    public UUID getMonitorId() { return monitorId; }
    public void setMonitorId(UUID monitorId) { this.monitorId = monitorId; }
    public Integer getStatusCode() { return statusCode; }
    public void setStatusCode(Integer statusCode) { this.statusCode = statusCode; }
    public Integer getResponseTimeMs() { return responseTimeMs; }
    public void setResponseTimeMs(Integer responseTimeMs) { this.responseTimeMs = responseTimeMs; }
    @JsonProperty("isSuccess")
    public boolean getIsSuccess() { return isSuccess; }
    public void setIsSuccess(boolean success) { isSuccess = success; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public Instant getCheckedAt() { return checkedAt; }
    public void setCheckedAt(Instant checkedAt) { this.checkedAt = checkedAt; }
}
