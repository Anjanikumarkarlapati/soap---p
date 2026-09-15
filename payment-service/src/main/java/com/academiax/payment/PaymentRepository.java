package com.academiax.payment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    Optional<Payment> findByStudentIdAndIdempotencyKey(UUID studentId, String idempotencyKey);

    Optional<Payment> findFirstByEnrollmentIdAndStatus(UUID enrollmentId, String status);

    List<Payment> findByStudentIdOrderByCreatedAtDesc(UUID studentId);

    List<Payment> findAllByOrderByCreatedAtDesc();

    List<Payment> findTop100ByEnrollmentNotifiedFalseAndStatusIn(Collection<String> statuses);

    List<Payment> findTop100ByStatusAndCreatedAtBefore(String status, Instant before);

    @Modifying
    @Transactional
    @Query("update Payment p set p.enrollmentNotified = true, p.failureReason = coalesce(?2, p.failureReason) where p.id = ?1")
    int markNotified(UUID id, String note);
}
