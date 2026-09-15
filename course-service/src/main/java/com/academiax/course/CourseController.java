package com.academiax.course;

import com.academiax.common.audit.AuditEvent;
import com.academiax.common.audit.AuditService;
import com.academiax.common.security.AuthUser;
import com.academiax.common.web.ApiException;
import com.academiax.common.web.ServiceClient;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
public class CourseController {

    public record CourseRequest(
            @NotBlank @Pattern(regexp = "^[A-Za-z]{2,5}\\d{3}$", message = "must look like CS101") String code,
            @NotBlank @Size(max = 160) String title,
            @Size(max = 4000) String description,
            @NotBlank @Size(max = 80) String department,
            UUID instructorId,
            @Min(1) @Max(10000) int capacity,
            @NotNull @DecimalMin("0.00") @Digits(integer = 8, fraction = 2) BigDecimal fee,
            @NotNull Instant enrollmentDeadline,
            @NotBlank @Size(max = 120) String schedule,
            @NotBlank @Pattern(regexp = "In person|Online|Hybrid") String mode,
            @NotBlank @Size(max = 40) String semester,
            @NotBlank @Pattern(regexp = "ACTIVE|DRAFT|ARCHIVED") String status,
            @Size(max = 255) @Pattern(regexp = "^/images/[\\w.-]+$", message = "must be a /images/ path") String image) {}

    public record CourseDto(UUID id, String code, String title, String description, String department, UUID instructorId,
                            String instructorName, int capacity, int enrolledCount, int seatsRemaining, BigDecimal fee,
                            Instant enrollmentDeadline, String schedule, String mode, String semester, String status, String image) {
        static CourseDto of(Course c) {
            return new CourseDto(c.getId(), c.getCode(), c.getTitle(), c.getDescription(), c.getDepartment(), c.getInstructorId(),
                    c.getInstructorName(), c.getCapacity(), c.getEnrolledCount(), Math.max(0, c.getCapacity() - c.getEnrolledCount()),
                    c.getFee(), c.getEnrollmentDeadline(), c.getSchedule(), c.getMode(), c.getSemester(), c.getStatus(), c.getImage());
        }
    }

    record InstructorDto(UUID id, String name, String role, String status) {}

    private final CourseRepository courses;
    private final AuditService audit;
    private final ServiceClient client;

    public CourseController(CourseRepository courses, AuditService audit, ServiceClient client) {
        this.courses = courses;
        this.audit = audit;
        this.client = client;
    }

    /** Students only see ACTIVE courses; staff see every status. */
    @GetMapping("/api/courses")
    public List<CourseDto> list(@RequestParam(required = false) String q) {
        AuthUser me = AuthUser.current();
        String term = q == null ? "" : q.trim().toLowerCase();
        return courses.findAllByOrderByEnrollmentDeadlineAsc().stream()
                .filter(c -> !me.is("STUDENT") || "ACTIVE".equals(c.getStatus()))
                .filter(c -> term.isEmpty() || (c.getCode() + " " + c.getTitle() + " " + c.getInstructorName()).toLowerCase().contains(term))
                .map(CourseDto::of).toList();
    }

    @GetMapping("/api/courses/mine")
    @PreAuthorize("hasRole('INSTRUCTOR')")
    public List<CourseDto> mine() {
        return courses.findByInstructorIdOrderByEnrollmentDeadlineAsc(AuthUser.current().id()).stream().map(CourseDto::of).toList();
    }

    @GetMapping("/api/courses/{id}")
    public CourseDto get(@PathVariable UUID id) {
        Course c = find(id);
        if (AuthUser.current().is("STUDENT") && !"ACTIVE".equals(c.getStatus())) throw ApiException.notFound("Course");
        return CourseDto.of(c);
    }

    @PostMapping("/api/courses")
    @PreAuthorize("hasAnyRole('INSTRUCTOR','ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public CourseDto create(@Valid @RequestBody CourseRequest req) {
        if (courses.existsByCodeIgnoreCase(req.code())) throw ApiException.conflict("Course code " + req.code().toUpperCase() + " already exists.");
        Course c = new Course(UUID.randomUUID());
        assignInstructor(c, req);
        courses.saveAndFlush(c);
        audit.record("COURSE_CREATED", "course", c.getId());
        return CourseDto.of(c);
    }

    @PutMapping("/api/courses/{id}")
    @PreAuthorize("hasAnyRole('INSTRUCTOR','ADMIN')")
    @Transactional
    public CourseDto update(@PathVariable UUID id, @Valid @RequestBody CourseRequest req) {
        Course c = find(id);
        AuthUser me = AuthUser.current();
        if (me.is("INSTRUCTOR") && !c.getInstructorId().equals(me.id())) throw ApiException.forbidden();
        if (courses.existsByCodeIgnoreCaseAndIdNot(req.code(), id)) throw ApiException.conflict("Course code " + req.code().toUpperCase() + " already exists.");
        if (req.capacity() < c.getEnrolledCount())
            throw ApiException.unprocessable("Capacity can't be lower than the " + c.getEnrolledCount() + " students already enrolled.");
        assignInstructor(c, req);
        courses.saveAndFlush(c); // DB check constraint still guards a reservation racing this edit
        audit.record("COURSE_UPDATED", "course", id);
        return CourseDto.of(c);
    }

    @GetMapping("/api/courses/audit")
    @PreAuthorize("hasRole('ADMIN')")
    public List<AuditEvent> auditLog(@RequestParam(defaultValue = "50") int size) {
        return audit.recent(size).getContent();
    }

    // ---- service-to-service (SYSTEM role only, not routed by the gateway) ----

    @GetMapping("/internal/courses/{id}")
    public CourseDto internalGet(@PathVariable UUID id) {
        return CourseDto.of(find(id));
    }

    /** Idempotent per reservationId: a retried call returns the course without taking a second seat. */
    @PostMapping("/internal/courses/{id}/reserve/{reservationId}")
    @Transactional
    public CourseDto reserve(@PathVariable UUID id, @PathVariable UUID reservationId) {
        if (courses.reservationExists(reservationId)) return CourseDto.of(find(id));
        if (courses.reserveSeat(id) == 1) {
            courses.insertReservation(reservationId, id); // same transaction as the increment
            audit.record("SEAT_RESERVED", "course", id);
            return CourseDto.of(find(id));
        }
        Course c = find(id); // explain why the atomic update matched nothing
        if (!"ACTIVE".equals(c.getStatus())) throw ApiException.notFound("Course");
        if (!c.getEnrollmentDeadline().isAfter(Instant.now()))
            throw ApiException.unprocessable("Enrollment for " + c.getCode() + " closed on the deadline.");
        throw ApiException.conflict(c.getCode() + " is full. No seats are available.");
    }

    /** Idempotent: only a reservation that still exists gives its seat back. */
    @PostMapping("/internal/courses/{id}/release/{reservationId}")
    @Transactional
    public CourseDto release(@PathVariable UUID id, @PathVariable UUID reservationId) {
        if (courses.deleteReservation(reservationId, id) == 1 && courses.releaseSeat(id) == 1) {
            audit.record("SEAT_RELEASED", "course", id);
        }
        return CourseDto.of(find(id));
    }

    private void assignInstructor(Course c, CourseRequest req) {
        AuthUser me = AuthUser.current();
        if (me.is("INSTRUCTOR")) {
            c.apply(req, me.id(), me.name()); // instructors can only own their courses
            return;
        }
        if (req.instructorId() == null) throw new ApiException(HttpStatus.BAD_REQUEST, "instructorId: is required");
        InstructorDto i = client.get("http://auth-service/internal/users/" + req.instructorId(), InstructorDto.class);
        if (!"INSTRUCTOR".equals(i.role())) throw ApiException.unprocessable("Selected user is not an instructor.");
        c.apply(req, i.id(), i.name());
    }

    private Course find(UUID id) {
        return courses.findById(id).orElseThrow(() -> ApiException.notFound("Course"));
    }
}
