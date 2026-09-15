package com.academiax.common.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** PRD §10 audit_events row. Each service keeps this table in its own schema. */
@Entity
@Table(name = "audit_events")
public class AuditEvent {

    @Id
    private UUID id;
    @Column(name = "actor_id")
    private String actorId;
    private String action;
    @Column(name = "entity_type")
    private String entityType;
    @Column(name = "entity_id")
    private String entityId;
    @Column(name = "correlation_id")
    private String correlationId;
    @Column(name = "created_at")
    private Instant createdAt;

    protected AuditEvent() {}

    public AuditEvent(String actorId, String action, String entityType, String entityId, String correlationId) {
        this.id = UUID.randomUUID();
        this.actorId = actorId;
        this.action = action;
        this.entityType = entityType;
        this.entityId = entityId;
        this.correlationId = correlationId;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getActorId() { return actorId; }
    public String getAction() { return action; }
    public String getEntityType() { return entityType; }
    public String getEntityId() { return entityId; }
    public String getCorrelationId() { return correlationId; }
    public Instant getCreatedAt() { return createdAt; }
}
