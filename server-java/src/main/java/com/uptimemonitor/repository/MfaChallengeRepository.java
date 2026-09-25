package com.uptimemonitor.repository;

import com.uptimemonitor.domain.MfaChallenge;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MfaChallengeRepository extends JpaRepository<MfaChallenge, UUID> {
}
