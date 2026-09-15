package com.academiax.enrollment;

import com.academiax.common.audit.AuditService;
import com.academiax.common.security.AuthUser;
import com.academiax.common.web.ApiException;
import com.academiax.common.web.ServiceClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.ResourceAccessException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Enrollment workflow (PRD §8–9). Seat reservation lives in course-service, so the flow is a
 * small saga: reserve the seat remotely (idempotent per enrollment ID), then persist the
 * enrollment locally; if the local write loses a race, the seat is released as compensation.
 * Remote calls are never made while holding a database transaction.
 */
@Service
public class EnrollmentService {

    public record CourseRef(UUID id, String code, String title, UUID instructorId, BigDecimal fee) {}

    static final Set<String> ACTIVE = Set.of("PENDING", "CONFIRMED");
    private static final Logger log = LoggerFactory.getLogger(EnrollmentService.class);

    private final EnrollmentRepository repo;
    private final ServiceClient client;
    private final AuditService audit;
    private final TransactionTemplate tx;
    private final Duration reservationTtl;

    public EnrollmentService(EnrollmentRepository repo, ServiceClient client, AuditService audit, TransactionTemplate tx,
                             @Value("${academiax.enrollment.reservation-ttl:PT30M}") Duration reservationTtl) {
        this.repo = repo;
        this.client = client;
        this.audit = audit;
        this.tx = tx;
        this.reservationTtl = reservationTtl;
    }

    public Enrollment create(AuthUser student, UUID courseId, String idempotencyKey) {
        var replay = repo.findByStudentIdAndIdempotencyKey(student.id(), idempotencyKey);
        if (replay.isPresent()) {
            if (!replay.get().getCourseId().equals(courseId)) throw ApiException.conflict("This request key was already used for a different course.");
            return replay.get();
        }
        if (repo.existsByStudentIdAndCourseIdAndStatusIn(student.id(), courseId, ACTIVE)) {
            throw ApiException.conflict("You already have an active enrollment in this course.");
        }

        UUID id = UUID.randomUUID();
        CourseRef course = reserveSeat(courseId, id); // 404 / 409 full / 422 deadline pass straight through
        try {
            return tx.execute(s -> {
                Enrollment e = repo.saveAndFlush(new Enrollment(id, student, course, idempotencyKey));
                audit.record("ENROLLMENT_RESERVED", "enrollment", id);
                return e;
            });
        } catch (DataIntegrityViolationException lostRace) {
            releaseQuietly(courseId, id);
            return repo.findByStudentIdAndIdempotencyKey(student.id(), idempotencyKey) // same key raced: return the winner
                    .orElseThrow(() -> ApiException.conflict("You already have an active enrollment in " + course.code() + "."));
        }
    }

    public Enrollment cancel(AuthUser me, UUID id) {
        Enrollment e = tx.execute(s -> {
            Enrollment x = repo.lockById(id).orElseThrow(() -> ApiException.notFound("Enrollment"));
            if (!x.getStudentId().equals(me.id()) && !me.is("ADMIN")) throw ApiException.forbidden();
            if (!"PENDING".equals(x.getStatus())) throw ApiException.unprocessable("Only pending enrollments can be cancelled.");
            x.cancel();
            audit.record("ENROLLMENT_CANCELLED", "enrollment", id);
            return x;
        });
        releaseSeat(e);
        return e;
    }

    /** Called by payment-service; safe to repeat. */
    public Enrollment applyPaymentResult(UUID id, boolean succeeded) {
        Enrollment e = tx.execute(s -> {
            Enrollment x = repo.lockById(id).orElseThrow(() -> ApiException.notFound("Enrollment"));
            if (succeeded) {
                if ("CONFIRMED".equals(x.getStatus())) return x;
                if (!"PENDING".equals(x.getStatus()))
                    throw ApiException.conflict("Enrollment is " + x.getStatus() + " and can't be confirmed.");
                x.confirm();
                audit.record("ENROLLMENT_CONFIRMED", "enrollment", id);
            } else if ("PENDING".equals(x.getStatus())) {
                x.fail("PAYMENT_FAILED"); // a failed payment never leaves a confirmed enrollment
                audit.record("ENROLLMENT_FAILED", "enrollment", id);
            }
            return x;
        });
        if ("FAILED".equals(e.getStatus()) && !e.isSeatReleased()) releaseSeat(e);
        return e;
    }

    /** Compensation for abandoned checkouts: expired reservations give their seat back. */
    @Scheduled(fixedDelayString = "${academiax.enrollment.expiry-check:PT1M}")
    public void expireReservations() {
        // ponytail: a payment finishing after expiry is rejected with 409 and logged for refund; a PROCESSING hold would close that gap.
        for (Enrollment stale : repo.findTop100ByStatusAndReservedAtBefore("PENDING", Instant.now().minus(reservationTtl))) {
            Enrollment e = tx.execute(s -> {
                Enrollment x = repo.lockById(stale.getId()).orElseThrow();
                if ("PENDING".equals(x.getStatus())) {
                    x.fail("RESERVATION_EXPIRED");
                    audit.record("ENROLLMENT_EXPIRED", "enrollment", x.getId());
                }
                return x;
            });
            if ("FAILED".equals(e.getStatus())) releaseSeat(e);
        }
    }

    /** Retries seat releases that failed because course-service was unreachable. */
    @Scheduled(fixedDelayString = "${academiax.enrollment.release-retry:PT15S}")
    public void retryReleases() {
        repo.findTop100ByStatusInAndSeatReleasedFalse(List.of("CANCELLED", "FAILED")).forEach(this::releaseSeat);
    }

    private CourseRef reserveSeat(UUID courseId, UUID reservationId) {
        String url = "http://course-service/internal/courses/" + courseId + "/reserve/" + reservationId;
        try {
            return client.post(url, null, CourseRef.class);
        } catch (ResourceAccessException timeout) {
            try {
                return client.post(url, null, CourseRef.class); // safe: reservation is idempotent per ID
            } catch (ResourceAccessException again) {
                releaseQuietly(courseId, reservationId);
                throw again;
            }
        }
    }

    private void releaseSeat(Enrollment e) {
        try {
            client.post("http://course-service/internal/courses/" + e.getCourseId() + "/release/" + e.getId(), null, Object.class);
            repo.markSeatReleased(e.getId());
        } catch (RuntimeException ex) {
            log.warn("Seat release for enrollment {} failed, will retry: {}", e.getId(), ex.getMessage());
        }
    }

    private void releaseQuietly(UUID courseId, UUID reservationId) {
        try {
            client.post("http://course-service/internal/courses/" + courseId + "/release/" + reservationId, null, Object.class);
        } catch (RuntimeException ex) {
            // ponytail: no enrollment row exists to retry from; orphaned seat_reservations need a reconciliation job.
            log.error("Compensating release failed course={} reservation={}: {}", courseId, reservationId, ex.getMessage());
        }
    }
}
