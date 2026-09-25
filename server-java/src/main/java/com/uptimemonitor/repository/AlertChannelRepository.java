package com.uptimemonitor.repository;

import com.uptimemonitor.domain.AlertChannel;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AlertChannelRepository extends JpaRepository<AlertChannel, UUID> {

    List<AlertChannel> findByOrganizationIdOrderByCreatedAtDesc(UUID organizationId);

    List<AlertChannel> findByOrganizationIdAndIsActiveTrue(UUID organizationId);

    Optional<AlertChannel> findByIdAndOrganizationId(UUID id, UUID organizationId);

    List<AlertChannel> findByIdIn(Collection<UUID> ids);
}
