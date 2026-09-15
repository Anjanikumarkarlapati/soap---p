CREATE TABLE enrollments (
    id              UUID PRIMARY KEY,
    student_id      UUID          NOT NULL,
    student_name    VARCHAR(120)  NOT NULL,
    student_email   VARCHAR(254)  NOT NULL,
    course_id       UUID          NOT NULL,
    course_code     VARCHAR(12)   NOT NULL,
    course_title    VARCHAR(160)  NOT NULL,
    instructor_id   UUID          NOT NULL,
    fee             NUMERIC(10,2) NOT NULL,
    status          VARCHAR(20)   NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'FAILED')),
    failure_reason  VARCHAR(120),
    idempotency_key VARCHAR(100)  NOT NULL,
    -- false while a CANCELLED/FAILED enrollment still holds its seat in course-service (retried by a job)
    seat_released   BOOLEAN       NOT NULL DEFAULT false,
    reserved_at     TIMESTAMPTZ   NOT NULL,
    confirmed_at    TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ   NOT NULL,
    version         BIGINT        NOT NULL DEFAULT 0
);
-- Retried requests with the same key return the original enrollment.
CREATE UNIQUE INDEX ux_enrollments_idempotency ON enrollments (student_id, idempotency_key);
-- A student can hold only one active enrollment per course, even under concurrent requests.
CREATE UNIQUE INDEX ux_enrollments_active ON enrollments (student_id, course_id) WHERE status IN ('PENDING', 'CONFIRMED');
CREATE INDEX ix_enrollments_student ON enrollments (student_id, reserved_at DESC);
CREATE INDEX ix_enrollments_course ON enrollments (course_id);
CREATE INDEX ix_enrollments_instructor ON enrollments (instructor_id);
CREATE INDEX ix_enrollments_pending ON enrollments (reserved_at) WHERE status = 'PENDING';
CREATE INDEX ix_enrollments_unreleased ON enrollments (updated_at) WHERE seat_released = false AND status IN ('CANCELLED', 'FAILED');

CREATE TABLE audit_events (
    id             UUID PRIMARY KEY,
    actor_id       VARCHAR(64) NOT NULL,
    action         VARCHAR(64) NOT NULL,
    entity_type    VARCHAR(40) NOT NULL,
    entity_id      VARCHAR(64) NOT NULL,
    correlation_id VARCHAR(64),
    created_at     TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_audit_created ON audit_events (created_at DESC);
