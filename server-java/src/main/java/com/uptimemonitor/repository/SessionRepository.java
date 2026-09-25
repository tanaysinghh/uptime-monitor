package com.uptimemonitor.repository;

import com.uptimemonitor.domain.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SessionRepository extends JpaRepository<Session, UUID> {

    Optional<Session> findByIdAndUserId(UUID id, UUID userId);

    @Query("select s from Session s where s.userId = :userId and s.revokedAt is null order by s.lastUsedAt desc nulls last")
    List<Session> findActiveByUser(@Param("userId") UUID userId);

    @Transactional
    @Modifying
    @Query("update Session s set s.revokedAt = :now where s.userId = :userId and s.revokedAt is null")
    int revokeAllForUser(@Param("userId") UUID userId, @Param("now") Instant now);

    @Transactional
    @Modifying
    @Query("update Session s set s.revokedAt = :now where s.userId = :userId and s.revokedAt is null and s.id <> :exceptId")
    int revokeAllForUserExcept(@Param("userId") UUID userId, @Param("exceptId") UUID exceptId, @Param("now") Instant now);
}
