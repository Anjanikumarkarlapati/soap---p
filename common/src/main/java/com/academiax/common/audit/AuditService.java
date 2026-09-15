package com.academiax.common.audit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger("AUDIT");
    private final AuditRepository repo;

    public AuditService(AuditRepository repo) {
        this.repo = repo;
    }

    /** Joins the caller's transaction so the audit row commits or rolls back with the change. */
    public void record(String action, String entityType, Object entityId) {
        String actor = MDC.get("actorId") == null ? "system" : MDC.get("actorId");
        var e = repo.save(new AuditEvent(actor, action, entityType, String.valueOf(entityId), MDC.get("correlationId")));
        log.info("action={} entityType={} entityId={} actorId={} correlationId={}", e.getAction(), e.getEntityType(), e.getEntityId(), actor, e.getCorrelationId());
    }

    public Page<AuditEvent> recent(int size) {
        return repo.findAll(PageRequest.of(0, Math.min(size, 200), Sort.by(Sort.Direction.DESC, "createdAt")));
    }
}
