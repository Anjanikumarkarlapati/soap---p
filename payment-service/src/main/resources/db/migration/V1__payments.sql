CREATE TABLE payments (
    id                  UUID PRIMARY KEY,
    enrollment_id       UUID          NOT NULL,
    student_id          UUID          NOT NULL,
    student_name        VARCHAR(120)  NOT NULL,
    course_code         VARCHAR(12)   NOT NULL,
    amount              NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    currency            CHAR(3)       NOT NULL,
    status              VARCHAR(20)   NOT NULL CHECK (status IN ('PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED')),
    provider_reference  VARCHAR(64),
    failure_reason      VARCHAR(120),
    idempotency_key     VARCHAR(100)  NOT NULL,
    -- false until enrollment-service has accepted the outcome (retried by a job)
    enrollment_notified BOOLEAN       NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ   NOT NULL,
    paid_at             TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ   NOT NULL,
    version             BIGINT        NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX ux_payments_idempotency ON payments (student_id, idempotency_key);
-- Never charge an enrollment twice, and never run two charges for it at once.
CREATE UNIQUE INDEX ux_payments_one_success ON payments (enrollment_id) WHERE status = 'SUCCEEDED';
CREATE UNIQUE INDEX ux_payments_one_processing ON payments (enrollment_id) WHERE status = 'PROCESSING';
CREATE INDEX ix_payments_student ON payments (student_id, created_at DESC);
CREATE INDEX ix_payments_enrollment ON payments (enrollment_id);
CREATE INDEX ix_payments_unnotified ON payments (updated_at) WHERE enrollment_notified = false;

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
