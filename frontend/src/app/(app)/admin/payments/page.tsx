"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { fmtDate, fmtMoney } from "@/lib/data";
import { PageHeader, Stat, StatusBadge, Table, CellGrid } from "@/components/ui";
import { SearchBar } from "@/components/course-admin";

export default function AdminPayments() {
  const { payments, enrollments, users, courses } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const rows = payments.map((p) => {
    const e = enrollments.find((x) => x.id === p.enrollmentId);
    return { p, student: users.find((u) => u.id === e?.studentId), course: courses.find((c) => c.id === e?.courseId) };
  }).filter(({ p, student, course }) =>
    `${p.id} ${p.providerReference ?? ""} ${student?.name} ${course?.code}`.toLowerCase().includes(q.toLowerCase()) && (!status || p.status === status));
  const sum = (s: string) => payments.filter((p) => p.status === s).reduce((t, p) => t + p.amount, 0);

  return (
    <>
      <PageHeader title="Payment monitoring" subtitle="Tuition payment lifecycle across all students" />
      <CellGrid className="mb-6 sm:grid-cols-3">
        <Stat label="Succeeded" value={fmtMoney(sum("SUCCEEDED"))} tone="success" hint={`${payments.filter((p) => p.status === "SUCCEEDED").length} payments`} />
        <Stat label="Processing" value={fmtMoney(sum("PROCESSING"))} tone="info" />
        <Stat label="Failed" value={fmtMoney(sum("FAILED"))} tone="error" hint={`${payments.filter((p) => p.status === "FAILED").length} payments — seats released`} />
      </CellGrid>
      <SearchBar label="Search payment ID, reference, student or course" value={q} onChange={setQ}>
        <div><label htmlFor="status" className="label">Status</label>
          <select id="status" className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option><option>PROCESSING</option><option>SUCCEEDED</option><option>FAILED</option><option>EXPIRED</option></select></div>
      </SearchBar>
      <Table head={["Payment", "Student", "Course", "Amount", "Reference", "Date", "Status"]} empty={rows.length === 0}>
        {rows.map(({ p, student, course }) => (
          <tr key={p.id} className="hover:bg-slate-50">
            <td className="px-4 py-3 font-mono text-xs">{p.id}<p className="caption">{p.enrollmentId}</p></td>
            <td className="px-4 py-3">{student?.name}</td>
            <td className="px-4 py-3">{course?.code}</td>
            <td className="px-4 py-3 font-medium">{fmtMoney(p.amount)}</td>
            <td className="px-4 py-3 font-mono text-xs">{p.providerReference ?? "—"}</td>
            <td className="px-4 py-3 text-muted">{fmtDate(p.paidAt ?? p.createdAt)}</td>
            <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
