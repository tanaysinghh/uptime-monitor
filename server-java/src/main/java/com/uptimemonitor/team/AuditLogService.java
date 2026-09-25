package com.uptimemonitor.team;

import com.uptimemonitor.common.Http;
import com.uptimemonitor.domain.AuditLog;
import com.uptimemonitor.repository.AuditLogRepository;
import com.uptimemonitor.security.AuthUser;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

/** Organization-level audit trail of administrative actions (AuditLog.create calls in Node). */
@Service
public class AuditLogService {

    private final AuditLogRepository auditLogs;

    public AuditLogService(AuditLogRepository auditLogs) {
        this.auditLogs = auditLogs;
    }

    public void record(AuthUser actor, String action, String resource, UUID resourceId, Map<String, Object> details,
                       HttpServletRequest request) {
        AuditLog entry = new AuditLog();
        entry.setOrganizationId(actor.organizationId());
        entry.setUserId(actor.id());
        entry.setAction(action);
        entry.setResource(resource);
        entry.setResourceId(resourceId);
        entry.setDetails(details);
        entry.setIpAddress(Http.clientIp(request));
        auditLogs.save(entry);
    }
}
