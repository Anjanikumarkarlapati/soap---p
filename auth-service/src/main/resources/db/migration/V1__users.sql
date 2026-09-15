CREATE TABLE users (
    id            UUID PRIMARY KEY,
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(254) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    role          VARCHAR(20)  NOT NULL CHECK (role IN ('STUDENT', 'INSTRUCTOR', 'ADMIN')),
    status        VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_users_email ON users (lower(email));

CREATE TABLE audit_events (
    id             UUID PRIMARY KEY,
    actor_id       VARCHAR(64)  NOT NULL,
    action         VARCHAR(64)  NOT NULL,
    entity_type    VARCHAR(40)  NOT NULL,
    entity_id      VARCHAR(64)  NOT NULL,
    correlation_id VARCHAR(64),
    created_at     TIMESTAMPTZ  NOT NULL
);
CREATE INDEX ix_audit_created ON audit_events (created_at DESC);
