package com.academiax.course;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface CourseRepository extends JpaRepository<Course, UUID> {

    /**
     * PRD §9: the seat check and the increment are one statement, so concurrent requests
     * can never both take the last seat. Returns 0 when the course is full, closed or inactive.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            UPDATE courses SET enrolled_count = enrolled_count + 1, updated_at = now()
            WHERE id = :id AND status = 'ACTIVE' AND enrollment_deadline > now() AND enrolled_count < capacity
            """, nativeQuery = true)
    int reserveSeat(@Param("id") UUID id);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "UPDATE courses SET enrolled_count = enrolled_count - 1, updated_at = now() WHERE id = :id AND enrolled_count > 0", nativeQuery = true)
    int releaseSeat(@Param("id") UUID id);

    @Query(value = "SELECT count(*) > 0 FROM seat_reservations WHERE reservation_id = :rid", nativeQuery = true)
    boolean reservationExists(@Param("rid") UUID reservationId);

    @Modifying
    @Query(value = "INSERT INTO seat_reservations (reservation_id, course_id) VALUES (:rid, :cid)", nativeQuery = true)
    void insertReservation(@Param("rid") UUID reservationId, @Param("cid") UUID courseId);

    @Modifying
    @Query(value = "DELETE FROM seat_reservations WHERE reservation_id = :rid AND course_id = :cid", nativeQuery = true)
    int deleteReservation(@Param("rid") UUID reservationId, @Param("cid") UUID courseId);

    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndIdNot(String code, UUID id);

    List<Course> findAllByOrderByEnrollmentDeadlineAsc();

    List<Course> findByInstructorIdOrderByEnrollmentDeadlineAsc(UUID instructorId);
}
