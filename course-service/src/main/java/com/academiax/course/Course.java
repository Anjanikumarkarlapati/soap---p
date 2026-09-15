package com.academiax.course;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "courses")
public class Course {

    @Id
    private UUID id;
    private String code;
    private String title;
    private String description;
    private String department;
    @Column(name = "instructor_id")
    private UUID instructorId;
    @Column(name = "instructor_name")
    private String instructorName;
    private int capacity;
    /** Never written by JPA updates: only the atomic reserve/release queries change it. */
    @Column(name = "enrolled_count", updatable = false)
    private int enrolledCount;
    private BigDecimal fee;
    @Column(name = "enrollment_deadline")
    private Instant enrollmentDeadline;
    private String schedule;
    private String mode;
    private String semester;
    private String status;
    private String image;
    @Version
    private long version;
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
    @Column(name = "updated_at")
    private Instant updatedAt;

    protected Course() {}

    Course(UUID id) {
        this.id = id;
        this.createdAt = Instant.now();
    }

    void apply(CourseController.CourseRequest r, UUID instructorId, String instructorName) {
        this.code = r.code().trim().toUpperCase();
        this.title = r.title().trim();
        this.description = r.description() == null ? "" : r.description().trim();
        this.department = r.department().trim();
        this.instructorId = instructorId;
        this.instructorName = instructorName;
        this.capacity = r.capacity();
        this.fee = r.fee();
        this.enrollmentDeadline = r.enrollmentDeadline();
        this.schedule = r.schedule().trim();
        this.mode = r.mode();
        this.semester = r.semester().trim();
        this.status = r.status();
        this.image = r.image();
        this.updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getCode() { return code; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getDepartment() { return department; }
    public UUID getInstructorId() { return instructorId; }
    public String getInstructorName() { return instructorName; }
    public int getCapacity() { return capacity; }
    public int getEnrolledCount() { return enrolledCount; }
    public BigDecimal getFee() { return fee; }
    public Instant getEnrollmentDeadline() { return enrollmentDeadline; }
    public String getSchedule() { return schedule; }
    public String getMode() { return mode; }
    public String getSemester() { return semester; }
    public String getStatus() { return status; }
    public String getImage() { return image; }
}
