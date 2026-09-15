package com.academiax.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    @Query("select u from User u where lower(u.email) = lower(?1)")
    Optional<User> findByEmail(String email);

    List<User> findByRoleOrderByName(String role);

    List<User> findAllByOrderByCreatedAtDesc();
}
