package com.academiax.enrollment;

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
public class EnrollmentController {

    public record CreateRequest(@NotNull UUID courseId) {}
    public record PaymentResult(@NotNull @Pattern(regexp = "SUCCEEDED|FAILED") String outcome) {}
    public record EnrollmentDto(UUID id, UUID studentId, String studentName, String studentEmail, UUID courseId, String courseCode,
                                String courseTitle, UUID instructorId, BigDecimal fee, String status, String failureReason,
                                Instant reservedAt, Instant confirmedAt) {
        static EnrollmentDto of(Enrollment e) {
            return new EnrollmentDto(e.getId(), e.getStudentId(), e.getStudentName(), e.getStudentEmail(), e.getCourseId(), e.getCourseCode(),
                    e.getCourseTitle(), e.getInstructorId(), e.getFee(), e.getStatus(), e.getFailureReason(), e.getReservedAt(), e.getConfirmedAt());
        }
    }

    private final EnrollmentService service;
    private final EnrollmentRepository repo;
    private final AuditService audit;

    public EnrollmentController(EnrollmentService service, EnrollmentRepository repo, AuditService audit) {
        this.service = service;
        this.repo = repo;
        this.audit = audit;
    }

    @PostMapping("/api/enrollments")
    @PreAuthorize("hasRole('STUDENT')")
    @ResponseStatus(HttpStatus.CREATED)
    public EnrollmentDto create(@Valid @RequestBody CreateRequest req, @RequestHeader("Idempotency-Key") String key) {
        return EnrollmentDto.of(service.create(AuthUser.current(), req.courseId(), validKey(key)));
    }

    @GetMapping("/api/enrollments/me")
    @PreAuthorize("hasRole('STUDENT')")
    public List<EnrollmentDto> mine() {
        return repo.findByStudentIdOrderByReservedAtDesc(AuthUser.current().id()).stream().map(EnrollmentDto::of).toList();
    }

    /** Admins see everything; instructors see enrollments in the courses they teach. */
    @GetMapping("/api/enrollments")
    @PreAuthorize("hasAnyRole('INSTRUCTOR','ADMIN')")
    public List<EnrollmentDto> list(@RequestParam(required = false) UUID courseId) {
        AuthUser me = AuthUser.current();
        List<Enrollment> list = me.is("ADMIN")
                ? (courseId == null ? repo.findAllByOrderByReservedAtDesc() : repo.findByCourseIdOrderByReservedAtDesc(courseId))
                : repo.findByInstructorIdOrderByReservedAtDesc(me.id()).stream().filter(e -> courseId == null || e.getCourseId().equals(courseId)).toList();
        return list.stream().map(EnrollmentDto::of).toList();
    }

    @GetMapping("/api/enrollments/audit")
    @PreAuthorize("hasRole('ADMIN')")
    public List<AuditEvent> auditLog(@RequestParam(defaultValue = "50") int size) {
        return audit.recent(size).getContent();
    }

    @GetMapping("/api/enrollments/{id}")
    public EnrollmentDto get(@PathVariable UUID id) {
        Enrollment e = repo.findById(id).orElseThrow(() -> ApiException.notFound("Enrollment"));
        AuthUser me = AuthUser.current();
        boolean allowed = me.is("ADMIN") || e.getStudentId().equals(me.id()) || (me.is("INSTRUCTOR") && e.getInstructorId().equals(me.id()));
        if (!allowed) throw ApiException.notFound("Enrollment"); // don't reveal other students' enrollments exist
        return EnrollmentDto.of(e);
    }

    @PostMapping("/api/enrollments/{id}/cancel")
    @PreAuthorize("hasAnyRole('STUDENT','ADMIN')")
    public EnrollmentDto cancel(@PathVariable UUID id) {
        return EnrollmentDto.of(service.cancel(AuthUser.current(), id));
    }

    // ---- service-to-service ----

    @GetMapping("/internal/enrollments/{id}")
    public EnrollmentDto internalGet(@PathVariable UUID id) {
        return repo.findById(id).map(EnrollmentDto::of).orElseThrow(() -> ApiException.notFound("Enrollment"));
    }

    @PostMapping("/internal/enrollments/{id}/payment-result")
    public EnrollmentDto paymentResult(@PathVariable UUID id, @Valid @RequestBody PaymentResult body) {
        return EnrollmentDto.of(service.applyPaymentResult(id, "SUCCEEDED".equals(body.outcome())));
    }

    static String validKey(String key) {
        if (key == null || key.length() < 8 || key.length() > 100 || !key.matches("[A-Za-z0-9-]+"))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Idempotency-Key must be 8-100 letters, digits or dashes.");
        return key;
    }
}
