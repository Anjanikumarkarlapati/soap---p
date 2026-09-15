package com.academiax.payment;

import com.academiax.common.audit.AuditEvent;
import com.academiax.common.audit.AuditService;
import com.academiax.common.security.AuthUser;
import com.academiax.common.web.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
public class PaymentController {

    /** simulate: demo-provider switch so the UI can exercise the failure path. */
    public record PayRequest(@NotNull UUID enrollmentId, @Pattern(regexp = "SUCCESS|DECLINE") String simulate) {}
    public record PaymentDto(UUID id, UUID enrollmentId, UUID studentId, String studentName, String courseCode, BigDecimal amount,
                             String currency, String status, String providerReference, String failureReason, Instant createdAt, Instant paidAt) {
        static PaymentDto of(Payment p) {
            return new PaymentDto(p.getId(), p.getEnrollmentId(), p.getStudentId(), p.getStudentName(), p.getCourseCode(), p.getAmount(),
                    p.getCurrency(), p.getStatus(), p.getProviderReference(), p.getFailureReason(), p.getCreatedAt(), p.getPaidAt());
        }
    }

    private final PaymentService service;
    private final PaymentRepository repo;
    private final AuditService audit;

    public PaymentController(PaymentService service, PaymentRepository repo, AuditService audit) {
        this.service = service;
        this.repo = repo;
        this.audit = audit;
    }

    @PostMapping("/api/payments")
    @PreAuthorize("hasRole('STUDENT')")
    @ResponseStatus(HttpStatus.CREATED)
    public PaymentDto pay(@Valid @RequestBody PayRequest req, @RequestHeader("Idempotency-Key") String key) {
        if (key.length() < 8 || key.length() > 100 || !key.matches("[A-Za-z0-9-]+"))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Idempotency-Key must be 8-100 letters, digits or dashes.");
        return PaymentDto.of(service.pay(AuthUser.current(), req.enrollmentId(), key, "DECLINE".equals(req.simulate())));
    }

    @GetMapping("/api/payments/me")
    @PreAuthorize("hasRole('STUDENT')")
    public List<PaymentDto> mine() {
        return repo.findByStudentIdOrderByCreatedAtDesc(AuthUser.current().id()).stream().map(PaymentDto::of).toList();
    }

    @GetMapping("/api/payments")
    @PreAuthorize("hasRole('ADMIN')")
    public List<PaymentDto> all() {
        return repo.findAllByOrderByCreatedAtDesc().stream().map(PaymentDto::of).toList();
    }

    @GetMapping("/api/payments/audit")
    @PreAuthorize("hasRole('ADMIN')")
    public List<AuditEvent> auditLog(@RequestParam(defaultValue = "50") int size) {
        return audit.recent(size).getContent();
    }

    @GetMapping("/api/payments/{id}")
    public PaymentDto get(@PathVariable UUID id) {
        Payment p = repo.findById(id).orElseThrow(() -> ApiException.notFound("Payment"));
        AuthUser me = AuthUser.current();
        if (!me.is("ADMIN") && !p.getStudentId().equals(me.id())) throw ApiException.notFound("Payment");
        return PaymentDto.of(p);
    }
}
