package com.academiax.enrollment;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EnrollmentRepository extends JpaRepository<Enrollment, UUID> {

    Optional<Enrollment> findByStudentIdAndIdempotencyKey(UUID studentId, String idempotencyKey);

    boolean existsByStudentIdAndCourseIdAndStatusIn(UUID studentId, UUID courseId, Collection<String> statuses);

    List<Enrollment> findByStudentIdOrderByReservedAtDesc(UUID studentId);

    List<Enrollment> findByInstructorIdOrderByReservedAtDesc(UUID instructorId);

    List<Enrollment> findByCourseIdOrderByReservedAtDesc(UUID courseId);

    List<Enrollment> findAllByOrderByReservedAtDesc();

    List<Enrollment> findTop100ByStatusAndReservedAtBefore(String status, Instant before);

    List<Enrollment> findTop100ByStatusInAndSeatReleasedFalse(Collection<String> statuses);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Enrollment e where e.id = ?1")
    Optional<Enrollment> lockById(UUID id);

    @Modifying
    @Transactional
    @Query("update Enrollment e set e.seatReleased = true where e.id = ?1")
    int markSeatReleased(UUID id);
}
