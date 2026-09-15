package com.academiax.course;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PRD §9 / §18: more simultaneous reservations than seats must never overbook.
 * Runs against the real PostgreSQL configured by DB_URL / DB_USERNAME / DB_PASSWORD.
 */
@SpringBootTest(properties = {"eureka.client.enabled=false", "spring.cloud.discovery.enabled=false"})
@EnabledIfEnvironmentVariable(named = "DB_PASSWORD", matches = ".+")
class SeatReservationConcurrencyTest {

    @Autowired CourseRepository courses;
    @Autowired TransactionTemplate tx;
    @Autowired JdbcTemplate jdbc;

    @Test
    void neverAllocatesMoreSeatsThanCapacity() throws Exception {
        UUID courseId = UUID.randomUUID();
        int capacity = 5, requests = 40;
        jdbc.update("""
                INSERT INTO courses (id, code, title, department, instructor_id, instructor_name, capacity, fee, enrollment_deadline, schedule, mode, semester, status)
                VALUES (?, ?, 'Concurrency test', 'Test', ?, 'Test', ?, 1, ?, 'TBA', 'Online', 'Test', 'ACTIVE')""",
                courseId, "TST" + (100 + (int) (Math.random() * 899)), UUID.randomUUID(), capacity, java.sql.Timestamp.from(Instant.now().plus(1, ChronoUnit.DAYS)));
        try {
            AtomicInteger granted = new AtomicInteger();
            CountDownLatch start = new CountDownLatch(1);
            try (var pool = Executors.newFixedThreadPool(requests)) {
                for (int i = 0; i < requests; i++) {
                    pool.submit(() -> {
                        start.await();
                        UUID rid = UUID.randomUUID();
                        Boolean ok = tx.execute(s -> {
                            if (courses.reserveSeat(courseId) != 1) return false;
                            courses.insertReservation(rid, courseId);
                            return true;
                        });
                        if (Boolean.TRUE.equals(ok)) granted.incrementAndGet();
                        return null;
                    });
                }
                start.countDown();
            }
            assertThat(granted.get()).isEqualTo(capacity);
            assertThat(jdbc.queryForObject("SELECT enrolled_count FROM courses WHERE id = ?", Integer.class, courseId)).isEqualTo(capacity);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM seat_reservations WHERE course_id = ?", Integer.class, courseId)).isEqualTo(capacity);
        } finally {
            jdbc.update("DELETE FROM seat_reservations WHERE course_id = ?", courseId);
            jdbc.update("DELETE FROM courses WHERE id = ?", courseId);
        }
    }
}
