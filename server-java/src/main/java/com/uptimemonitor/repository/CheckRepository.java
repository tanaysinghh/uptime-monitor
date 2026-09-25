package com.uptimemonitor.repository;

import com.uptimemonitor.domain.Check;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface CheckRepository extends JpaRepository<Check, UUID> {

    List<Check> findByMonitorIdAndCheckedAtGreaterThanEqualOrderByCheckedAtAsc(UUID monitorId, Instant since);

    @Modifying
    @Query("delete from Check c where c.monitorId = :monitorId")
    int deleteByMonitorId(@Param("monitorId") UUID monitorId);

    @Transactional
    @Modifying
    @Query("delete from Check c where c.checkedAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") Instant cutoff);
}
