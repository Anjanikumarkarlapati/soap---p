package com.academiax.payment;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "payments")
public class Payment {

    @Id
    private UUID id;
    @Column(name = "enrollment_id")
    private UUID enrollmentId;
    @Column(name = "student_id")
    private UUID studentId;
    @Column(name = "student_name")
    private String studentName;
    @Column(name = "course_code")
    private String courseCode;
    private BigDecimal amount;
    private String currency;
    private String status;
    @Column(name = "provider_reference")
    private String providerReference;
    @Column(name = "failure_reason")
    private String failureReason;
    @Column(name = "idempotency_key")
    private String idempotencyKey;
    @Column(name = "enrollment_notified")
    private boolean enrollmentNotified;
    @Column(name = "created_at")
    private Instant createdAt;
    @Column(name = "paid_at")
    private Instant paidAt;
    @Column(name = "updated_at")
    private Instant updatedAt;
    @Version
    private long version;

    protected Payment() {}

    Payment(UUID id, PaymentService.EnrollmentRef e, String currency, String idempotencyKey) {
        this.id = id;
        this.enrollmentId = e.id();
        this.studentId = e.studentId();
        this.studentName = e.studentName();
        this.courseCode = e.courseCode();
        this.amount = e.fee(); // amount comes from the enrollment snapshot, never from the client
        this.currency = currency;
        this.status = "PROCESSING";
        this.idempotencyKey = idempotencyKey;
        this.createdAt = this.updatedAt = Instant.now();
    }

    void succeed(String reference) {
        status = "SUCCEEDED";
        providerReference = reference;
        paidAt = updatedAt = Instant.now();
    }

    void fail(String status, String reason) {
        this.status = status;
        failureReason = reason;
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getEnrollmentId() { return enrollmentId; }
    public UUID getStudentId() { return studentId; }
    public String getStudentName() { return studentName; }
    public String getCourseCode() { return courseCode; }
    public BigDecimal getAmount() { return amount; }
    public String getCurrency() { return currency; }
    public String getStatus() { return status; }
    public String getProviderReference() { return providerReference; }
    public String getFailureReason() { return failureReason; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getPaidAt() { return paidAt; }
}
