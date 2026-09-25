package com.uptimemonitor.repository;

import com.uptimemonitor.domain.Monitor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MonitorRepository extends JpaRepository<Monitor, UUID> {

    List<Monitor> findByOrganizationIdOrderByCreatedAtDesc(UUID organizationId);

    List<Monitor> findByOrganizationId(UUID organizationId);

    Optional<Monitor> findByIdAndOrganizationId(UUID id, UUID organizationId);

    Optional<Monitor> findByHeartbeatToken(String heartbeatToken);

    boolean existsByIdAndOrganizationId(UUID id, UUID organizationId);

    @Query("select m from Monitor m where m.organizationId = :orgId and m.status <> 'paused' order by m.name asc")
    List<Monitor> findPublicByOrganization(@Param("orgId") UUID organizationId);

    @Query("select m from Monitor m where m.status <> 'paused' and m.monitorType = 'http'")
    List<Monitor> findActiveHttpMonitors();

    @Query("select m from Monitor m where m.status <> 'paused' and m.monitorType = 'heartbeat' and m.maintenanceMode = false")
    List<Monitor> findActiveHeartbeatMonitors();
}
