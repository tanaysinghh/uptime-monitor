package com.uptimemonitor.repository;

import com.uptimemonitor.domain.SecurityEvent;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SecurityEventRepository extends JpaRepository<SecurityEvent, UUID> {

    List<SecurityEvent> findByUserIdOrderByCreatedAtDesc(UUID userId, Limit limit);

    List<SecurityEvent> findByUserIdAndEventType(UUID userId, String eventType);
}
