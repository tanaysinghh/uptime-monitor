package com.uptimemonitor.repository;

import com.uptimemonitor.domain.AlertLog;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface AlertLogRepository extends JpaRepository<AlertLog, UUID> {

    List<AlertLog> findByMonitorIdInOrderBySentAtDesc(Collection<UUID> monitorIds, Limit limit);

    List<AlertLog> findByMonitorId(UUID monitorId);

    @Transactional
    @Modifying
    @Query("delete from AlertLog l where l.channelId = :channelId")
    int deleteByChannelId(@Param("channelId") UUID channelId);
}
