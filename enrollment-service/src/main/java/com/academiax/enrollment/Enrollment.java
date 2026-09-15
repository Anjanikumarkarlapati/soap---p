package com.academiax.enrollment;

import com.academiax.common.security.AuthUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "enrollments")
public class Enrollment {

    @Id
    private UUID id;
    @Column(name = "student_id")
    private UUID studentId;
    @Column(name = "student_name")
    private String studentName;
    @Column(name = "student_email")
    private String studentEmail;
    @Column(name = "course_id")
    private UUID courseId;
    @Column(name = "course_code")
    private String courseCode;
    @Column(name = "course_title")
    private String courseTitle;
    @Column(name = "instructor_id")
    private UUID instructorId;
    private BigDecimal fee;
    private String status;
    @Column(name = "failure_reason")
    private String failureReason;
    @Column(name = "idempotency_key")
    private String idempotencyKey;
    @Column(name = "seat_released")
    private boolean seatReleased;
    @Column(name = "reserved_at")
    private Instant reservedAt;
    @Column(name = "confirmed_at")
    private Instant confirmedAt;
    @Column(name = "updated_at")
    private Instant updatedAt;
    @Version
    private long version;

    protected Enrollment() {}

    Enrollment(UUID id, AuthUser student, EnrollmentService.CourseRef course, String idempotencyKey) {
        this.id = id;
        this.studentId = student.id();
        this.studentName = student.name();
        this.studentEmail = student.email();
        this.courseId = course.id();
        this.courseCode = course.code();
        this.courseTitle = course.title();
        this.instructorId = course.instructorId();
        this.fee = course.fee();
        this.status = "PENDING";
        this.idempotencyKey = idempotencyKey;
        this.reservedAt = this.updatedAt = Instant.now();
    }

    void confirm() {
        status = "CONFIRMED";
        confirmedAt = updatedAt = Instant.now();
    }

    void fail(String reason) {
        status = "FAILED";
        failureReason = reason;
        updatedAt = Instant.now();
    }

    void cancel() {
        status = "CANCELLED";
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getStudentId() { return studentId; }
    public String getStudentName() { return studentName; }
    public String getStudentEmail() { return studentEmail; }
    public UUID getCourseId() { return courseId; }
    public String getCourseCode() { return courseCode; }
    public String getCourseTitle() { return courseTitle; }
    public UUID getInstructorId() { return instructorId; }
    public BigDecimal getFee() { return fee; }
    public String getStatus() { return status; }
    public String getFailureReason() { return failureReason; }
    public boolean isSeatReleased() { return seatReleased; }
    public Instant getReservedAt() { return reservedAt; }
    public Instant getConfirmedAt() { return confirmedAt; }
}
