package com.uptimemonitor.repository;

import com.uptimemonitor.domain.Incident;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface IncidentRepository extends JpaRepository<Incident, UUID> {

    List<Incident> findByMonitorIdOrderByStartedAtDesc(UUID monitorId, Limit limit);

    List<Incident> findByMonitorIdAndStartedAtGreaterThanEqualOrderByStartedAtDesc(UUID monitorId, Instant since);

    @Query("select i from Incident i where i.monitorId = :monitorId and i.status <> 'resolved' order by i.startedAt desc limit 1")
    Optional<Incident> findLatestOpen(@Param("monitorId") UUID monitorId);

    @Query("select i from Incident i where i.monitorId in :monitorIds and i.status <> 'resolved' order by i.startedAt desc")
    List<Incident> findOpenByMonitorIds(@Param("monitorIds") Collection<UUID> monitorIds);

    @Query("select i from Incident i where i.monitorId in :monitorIds and i.status = 'resolved' order by i.startedAt desc")
    List<Incident> findResolvedByMonitorIds(@Param("monitorIds") Collection<UUID> monitorIds, Limit limit);

    @Modifying
    @Query("delete from Incident i where i.monitorId = :monitorId")
    int deleteByMonitorId(@Param("monitorId") UUID monitorId);
}
