package com.uptimemonitor.repository;

import com.uptimemonitor.domain.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    List<AuditLog> findTop100ByOrganizationIdOrderByCreatedAtDesc(UUID organizationId);
}
