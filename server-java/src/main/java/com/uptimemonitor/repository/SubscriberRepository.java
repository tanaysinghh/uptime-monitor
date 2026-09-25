package com.uptimemonitor.repository;

import com.uptimemonitor.domain.Subscriber;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SubscriberRepository extends JpaRepository<Subscriber, UUID> {

    Optional<Subscriber> findByOrganizationIdAndEmail(UUID organizationId, String email);

    Optional<Subscriber> findByConfirmToken(String confirmToken);

    List<Subscriber> findByOrganizationIdOrderByCreatedAtDesc(UUID organizationId);
}
