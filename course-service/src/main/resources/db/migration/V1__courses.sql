CREATE TABLE courses (
    id                  UUID PRIMARY KEY,
    code                VARCHAR(12)   NOT NULL,
    title               VARCHAR(160)  NOT NULL,
    description         TEXT          NOT NULL DEFAULT '',
    department          VARCHAR(80)   NOT NULL,
    instructor_id       UUID          NOT NULL,
    instructor_name     VARCHAR(120)  NOT NULL,
    capacity            INTEGER       NOT NULL CHECK (capacity > 0),
    enrolled_count      INTEGER       NOT NULL DEFAULT 0,
    fee                 NUMERIC(10,2) NOT NULL CHECK (fee >= 0),
    enrollment_deadline TIMESTAMPTZ   NOT NULL,
    schedule            VARCHAR(120)  NOT NULL,
    mode                VARCHAR(20)   NOT NULL CHECK (mode IN ('In person', 'Online', 'Hybrid')),
    semester            VARCHAR(40)   NOT NULL,
    status              VARCHAR(20)   NOT NULL CHECK (status IN ('ACTIVE', 'DRAFT', 'ARCHIVED')),
    image               VARCHAR(255),
    version             BIGINT        NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    -- Last line of defence against over-allocation, whatever the application does.
    CONSTRAINT ck_seats CHECK (enrolled_count >= 0 AND enrolled_count <= capacity)
);
CREATE UNIQUE INDEX ux_courses_code ON courses (upper(code));
CREATE INDEX ix_courses_instructor ON courses (instructor_id);

-- One row per held seat, keyed by the enrollment ID. Makes reserve/release idempotent,
-- so enrollment-service can safely retry after a timeout or compensate twice.
CREATE TABLE seat_reservations (
    reservation_id UUID PRIMARY KEY,
    course_id      UUID        NOT NULL REFERENCES courses (id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
