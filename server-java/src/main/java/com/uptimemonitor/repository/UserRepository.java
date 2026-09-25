package com.uptimemonitor.repository;

import com.uptimemonitor.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    Optional<User> findByIdAndOrganizationId(UUID id, UUID organizationId);

    List<User> findByOrganizationIdOrderByCreatedAtAsc(UUID organizationId);

    List<User> findByIdIn(Collection<UUID> ids);
}
