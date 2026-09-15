"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { fmtDate } from "@/lib/data";
import { Badge, Modal, PageHeader, Table } from "@/components/ui";

// Illustrative Eureka registry view; wire to Actuator /health + Eureka /eureka/apps when backend is live.
const REGISTRY = [
  { id: "API-GATEWAY", port: 8080, instances: ["gateway-7c9f:8080", "gateway-2ab1:8080"] },
  { id: "AUTH-SERVICE", port: 8081, instances: ["auth-5d21:8081", "auth-9e03:8081"] },
  { id: "COURSE-SERVICE", port: 8082, instances: ["course-4f8a:8082", "course-1c77:8082"] },
  { id: "ENROLLMENT-SERVICE", port: 8083, instances: ["enrollment-6b2e:8083", "enrollment-0d94:8083"] },
  { id: "PAYMENT-SERVICE", port: 8084, instances: ["payment-3a5c:8084", "payment-8f10:8084"] },
];

export default function SystemPage() {
  const { audit, resetDemo, toast } = useStore();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <PageHeader title="System" subtitle="Service discovery, health and audit trail"
        actions={<button className="btn-secondary" onClick={() => setConfirm(true)}>Reset demo data</button>} />

      <section aria-labelledby="eu" className="mb-8">
        <h2 id="eu" className="h2 mb-3">Eureka registry</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {REGISTRY.map((s) => (
            <div key={s.id} className="card p-5">
              <div className="flex items-center justify-between gap-2"><p className="font-mono text-sm font-semibold">{s.id}</p><Badge tone="success">UP</Badge></div>
              <ul className="mt-3 space-y-1.5">
                {s.instances.map((i) => (
                  <li key={i} className="flex items-center justify-between text-xs"><span className="font-mono text-muted">{i}</span><span className="text-success">● healthy</span></li>
                ))}
              </ul>
              <p className="caption mt-3">Load balanced · Spring Cloud LoadBalancer</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="au">
        <h2 id="au" className="h2 mb-3">Audit log</h2>
        <Table head={["Time", "Action", "Entity", "Actor", "Correlation ID"]} empty={audit.length === 0}>
          {audit.map((a) => (
            <tr key={a.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3 text-muted">{fmtDate(a.createdAt)}</td>
              <td className="px-4 py-3 font-medium">{a.action}</td>
              <td className="px-4 py-3">{a.entityType} <span className="font-mono text-xs">{a.entityId}</span></td>
              <td className="px-4 py-3 font-mono text-xs">{a.actorId}</td>
              <td className="px-4 py-3 font-mono text-xs">{a.correlationId}</td>
            </tr>
          ))}
        </Table>
      </section>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Reset demo data?"
        footer={<><button className="btn-secondary" onClick={() => setConfirm(false)}>Cancel</button>
          <button className="btn-danger" onClick={() => { resetDemo(); setConfirm(false); toast("Demo data restored", "info"); }}>Reset data</button></>}>
        <p className="text-sm text-muted">All courses, enrollments, payments and audit events created in this browser will be replaced with the original sample data.</p>
      </Modal>
    </>
  );
}
