"use client";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { fmtDate, fmtMoney, isClosed, seatsLeft } from "@/lib/data";
import { AvailabilityBadge, Badge, CapacityBar, PageHeader, Stat, StatusBadge, CellGrid } from "@/components/ui";

const SERVICES = ["API-GATEWAY", "AUTH-SERVICE", "COURSE-SERVICE", "ENROLLMENT-SERVICE", "PAYMENT-SERVICE"];

export default function AdminDashboard() {
  const { users, courses, enrollments, payments, audit } = useStore();
  const revenue = payments.filter((p) => p.status === "SUCCEEDED").reduce((s, p) => s + p.amount, 0);
  const nearFull = courses.filter((c) => c.status === "ACTIVE" && !isClosed(c) && seatsLeft(c) <= Math.max(3, c.capacity * 0.1));
  const byStatus = (["CONFIRMED", "PENDING", "FAILED", "CANCELLED"] as const).map((s) => [s, enrollments.filter((e) => e.status === s).length] as const);
  const max = Math.max(1, ...byStatus.map(([, n]) => n));

  return (
    <>
      <PageHeader title="Admin dashboard" subtitle="Platform overview · Fall 2026 registration" actions={<Link href="/admin/courses/new" className="btn-primary">+ New course</Link>} />
      <CellGrid className="sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total users" value={users.length} hint={`${users.filter((u) => u.role === "STUDENT").length} students`} />
        <Stat label="Active courses" value={courses.filter((c) => c.status === "ACTIVE").length} tone="info" hint={`${courses.filter(isClosed).length} past deadline`} />
        <Stat label="Enrollments" value={enrollments.length} tone="success" hint={`${enrollments.filter((e) => e.status === "PENDING").length} pending payment`} />
        <Stat label="Tuition collected" value={fmtMoney(revenue)} tone="warning" hint={`${payments.filter((p) => p.status === "FAILED").length} failed payments`} />
      </CellGrid>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="card p-6" aria-labelledby="st">
          <h2 id="st" className="h3">Enrollment status</h2>
          <ul className="mt-4 space-y-3">
            {byStatus.map(([s, n]) => (
              <li key={s}>
                <div className="mb-1 flex justify-between text-sm"><StatusBadge status={s} /><span className="font-medium">{n}</span></div>
                <div className="h-2 rounded-full bg-slate-100"><div className={`h-full rounded-full ${s === "CONFIRMED" ? "bg-success" : s === "PENDING" ? "bg-warning" : s === "FAILED" ? "bg-error" : "bg-slate-400"}`} style={{ width: `${(n / max) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-6" aria-labelledby="nf">
          <div className="flex items-center justify-between"><h2 id="nf" className="h3">Full & near-full courses</h2><Link href="/admin/courses" className="text-sm text-primary hover:underline">All</Link></div>
          <ul className="mt-4 space-y-4">
            {nearFull.map((c) => (
              <li key={c.id}>
                <div className="mb-1 flex items-center justify-between gap-2"><span className="text-sm font-medium">{c.code}</span><AvailabilityBadge course={c} /></div>
                <CapacityBar course={c} />
              </li>
            ))}
            {nearFull.length === 0 && <li className="text-sm text-muted">No courses near capacity.</li>}
          </ul>
        </section>

        <section className="card p-6" aria-labelledby="sh">
          <div className="flex items-center justify-between"><h2 id="sh" className="h3">Service health</h2><Link href="/admin/system" className="text-sm text-primary hover:underline">Details</Link></div>
          <ul className="mt-4 divide-y divide-border">
            {SERVICES.map((s) => (
              <li key={s} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-mono text-xs">{s}</span><Badge tone="success">UP · 2 instances</Badge>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card mt-6 p-6" aria-labelledby="au">
        <h2 id="au" className="h3">Recent audit events</h2>
        <ul className="mt-4 divide-y divide-border text-sm">
          {audit.slice(0, 6).map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
              <span className="font-medium">{a.action}</span>
              <span className="text-muted">{a.entityType} {a.entityId}</span>
              <span className="caption font-mono">corr {a.correlationId.slice(0, 8)}</span>
              <span className="caption ml-auto">{fmtDate(a.createdAt)}</span>
            </li>
          ))}
          {audit.length === 0 && <li className="py-2 text-muted">No activity recorded yet this session.</li>}
        </ul>
      </section>
    </>
  );
}
