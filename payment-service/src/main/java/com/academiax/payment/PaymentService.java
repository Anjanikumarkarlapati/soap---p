package com.academiax.payment;

import com.academiax.common.audit.AuditService;
import com.academiax.common.security.AuthUser;
import com.academiax.common.web.ApiException;
import com.academiax.common.web.ServiceClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

/**
 * Tuition payment lifecycle (PRD §8, FR-09/10). The charge result is stored before the enrollment is
 * notified; if enrollment-service is unreachable the notification is retried until it lands, so
 * payment and enrollment states converge instead of drifting apart.
 */
@Service
public class PaymentService {

    public record EnrollmentRef(UUID id, UUID studentId, String studentName, String courseCode, BigDecimal fee, String status) {}
    record PaymentResult(String outcome) {}
    record ProviderResult(boolean success, String reference, String reason) {}

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final PaymentRepository repo;
    private final ServiceClient client;
    private final AuditService audit;
    private final TransactionTemplate tx;
    private final String currency;
    private final Duration processingTimeout;

    public PaymentService(PaymentRepository repo, ServiceClient client, AuditService audit, TransactionTemplate tx,
                          @Value("${academiax.payment.currency:USD}") String currency,
                          @Value("${academiax.payment.processing-timeout:PT10M}") Duration processingTimeout) {
        this.repo = repo;
        this.client = client;
        this.audit = audit;
        this.tx = tx;
        this.currency = currency;
        this.processingTimeout = processingTimeout;
    }

    public Payment pay(AuthUser student, UUID enrollmentId, String idempotencyKey, boolean simulateDecline) {
        var replay = repo.findByStudentIdAndIdempotencyKey(student.id(), idempotencyKey);
        if (replay.isPresent()) {
            if (!replay.get().getEnrollmentId().equals(enrollmentId)) throw ApiException.conflict("This request key was already used for a different enrollment.");
            return replay.get();
        }
        var alreadyPaid = repo.findFirstByEnrollmentIdAndStatus(enrollmentId, "SUCCEEDED");
        if (alreadyPaid.isPresent()) {
            if (!alreadyPaid.get().getStudentId().equals(student.id())) throw ApiException.notFound("Enrollment");
            return alreadyPaid.get(); // already paid: show the receipt, never charge again
        }

        EnrollmentRef e = client.get("http://enrollment-service/internal/enrollments/" + enrollmentId, EnrollmentRef.class);
        if (!e.studentId().equals(student.id())) throw ApiException.notFound("Enrollment");
        if (!"PENDING".equals(e.status())) throw ApiException.unprocessable("This enrollment is " + e.status().toLowerCase() + " and can't be paid.");

        Payment started;
        try {
            started = tx.execute(s -> {
                Payment p = repo.saveAndFlush(new Payment(UUID.randomUUID(), e, currency, idempotencyKey));
                audit.record("PAYMENT_STARTED", "payment", p.getId());
                return p;
            });
        } catch (DataIntegrityViolationException concurrent) {
            return repo.findByStudentIdAndIdempotencyKey(student.id(), idempotencyKey)
                    .orElseThrow(() -> ApiException.conflict("A payment for this enrollment is already in progress."));
        }

        ProviderResult result = charge(started, simulateDecline);
        Payment finished = tx.execute(s -> {
            Payment p = repo.findById(started.getId()).orElseThrow();
            if (result.success()) {
                p.succeed(result.reference());
                audit.record("PAYMENT_SUCCEEDED", "payment", p.getId());
            } else {
                p.fail("FAILED", result.reason());
                audit.record("PAYMENT_FAILED", "payment", p.getId());
            }
            return p;
        });
        notifyEnrollment(finished);
        return finished;
    }

    /**
     * ponytail: simulated provider for the MVP (PRD scopes out real gateways). Replace this method with the
     * provider SDK call; card data must stay in the provider's hosted flow and never reach this service.
     */
    ProviderResult charge(Payment p, boolean simulateDecline) {
        try {
            Thread.sleep(800);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }
        return simulateDecline
                ? new ProviderResult(false, null, "CARD_DECLINED")
                : new ProviderResult(true, "PRV-" + HexFormat.of().formatHex(RANDOM.generateSeed(4)).toUpperCase(), null);
    }

    void notifyEnrollment(Payment p) {
        String outcome = "SUCCEEDED".equals(p.getStatus()) ? "SUCCEEDED" : "FAILED";
        try {
            client.post("http://enrollment-service/internal/enrollments/" + p.getEnrollmentId() + "/payment-result", new PaymentResult(outcome), Object.class);
            repo.markNotified(p.getId(), null);
        } catch (ApiException rejected) {
            if (rejected.status() != HttpStatus.CONFLICT) throw rejected;
            // Money was taken but the reservation had already expired or been cancelled.
            log.error("REFUND REQUIRED payment={} enrollment={}: {}", p.getId(), p.getEnrollmentId(), rejected.getMessage());
            repo.markNotified(p.getId(), "REFUND_REQUIRED");
            audit.record("PAYMENT_REFUND_REQUIRED", "payment", p.getId());
        } catch (RuntimeException unreachable) {
            log.warn("Enrollment notification for payment {} failed, will retry: {}", p.getId(), unreachable.getMessage());
        }
    }

    @Scheduled(fixedDelayString = "${academiax.payment.notify-retry:PT15S}")
    public void retryNotifications() {
        repo.findTop100ByEnrollmentNotifiedFalseAndStatusIn(List.of("SUCCEEDED", "FAILED", "EXPIRED")).forEach(this::notifyEnrollment);
    }

    /** A charge that never finished (e.g. the instance crashed mid-call) must not block the enrollment forever. */
    @Scheduled(fixedDelayString = "${academiax.payment.expiry-check:PT1M}")
    public void expireStuckPayments() {
        for (Payment stuck : repo.findTop100ByStatusAndCreatedAtBefore("PROCESSING", Instant.now().minus(processingTimeout))) {
            Payment p = tx.execute(s -> {
                Payment x = repo.findById(stuck.getId()).orElseThrow();
                if ("PROCESSING".equals(x.getStatus())) {
                    x.fail("EXPIRED", "PROVIDER_TIMEOUT");
                    audit.record("PAYMENT_EXPIRED", "payment", x.getId());
                }
                return x;
            });
            if ("EXPIRED".equals(p.getStatus())) notifyEnrollment(p);
        }
    }
}
