"use client";
import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { EnrollmentStatus, fmtDate, fmtMoney } from "@/lib/data";
import { EmptyState, Modal, PageHeader, StatusBadge, Table } from "@/components/ui";

const TABS: ("ALL" | EnrollmentStatus)[] = ["ALL", "PENDING", "CONFIRMED", "CANCELLED", "FAILED"];

export default function MyEnrollments() {
  const { user, enrollments, courses, payments, cancelEnrollment, toast } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]>("ALL");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const mine = enrollments.filter((e) => e.studentId === user!.id);
  const list = mine.filter((e) => tab === "ALL" || e.status === tab);
  const course = (id: string) => courses.find((c) => c.id === id)!;
  const payment = (id: string) => payments.find((p) => p.enrollmentId === id && p.status === "SUCCEEDED") ?? payments.find((p) => p.enrollmentId === id);

  if (mine.length === 0) {
    return (
      <>
        <PageHeader title="My enrollments" />
        <EmptyState title="You haven’t enrolled in any courses" body="Find a course with open seats and reserve your place before the deadline." action={<Link href="/student/courses" className="btn-primary">Browse courses</Link>} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="My enrollments" subtitle="Track reservation, payment and confirmation status" actions={<Link href="/student/courses" className="btn-secondary">Browse courses</Link>} />

      <div role="tablist" aria-label="Filter by status" className="mb-4 flex overflow-x-auto border-[0.8px] border-paper">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`mono-label whitespace-nowrap border-r-[0.8px] border-paper px-4 py-2.5 font-bold ${tab === t ? "bg-paper text-navy" : "hover:bg-paper/10"}`}>
            {t === "ALL" ? "All" : t[0] + t.slice(1).toLowerCase()} ({t === "ALL" ? mine.length : mine.filter((e) => e.status === t).length})
          </button>
        ))}
      </div>

      <Table head={["Course", "Enrollment", "Reserved", "Tuition", "Payment", "Status", ""]} empty={list.length === 0}>
        {list.map((e) => {
          const c = course(e.courseId), p = payment(e.id);
          return (
            <tr key={e.id} className="hover:bg-slate-50">
              <td className="px-4 py-3"><Link href={`/student/courses/${c.id}`} className="font-medium hover:text-primary">{c.code}</Link><p className="caption">{c.title}</p></td>
              <td className="px-4 py-3 font-mono text-xs">{e.id}</td>
              <td className="px-4 py-3 text-muted">{fmtDate(e.reservedAt)}</td>
              <td className="px-4 py-3">{fmtMoney(c.fee)}</td>
              <td className="px-4 py-3">{p ? <StatusBadge status={p.status} /> : <span className="caption">Not started</span>}</td>
              <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
              <td className="px-4 py-3 text-right">
                {e.status === "PENDING" && (
                  <div className="flex justify-end gap-2">
                    <button className="btn-ghost px-3 py-1.5 text-error" onClick={() => setCancelId(e.id)}>Cancel</button>
                    <Link href={`/student/pay/${e.id}`} className="btn-primary px-3 py-1.5">Pay now</Link>
                  </div>
                )}
                {e.status === "CONFIRMED" && p && <Link href={`/student/pay/${e.id}`} className="btn-ghost px-3 py-1.5">Receipt</Link>}
              </td>
            </tr>
          );
        })}
      </Table>

      <Modal open={!!cancelId} onClose={() => setCancelId(null)} title="Cancel this enrollment?"
        footer={<>
          <button className="btn-secondary" onClick={() => setCancelId(null)}>Keep my seat</button>
          <button className="btn-danger" onClick={() => { cancelEnrollment(cancelId!); toast("Enrollment cancelled and seat released", "info"); setCancelId(null); }}>Cancel enrollment</button>
        </>}>
        <p className="text-sm text-muted">Your reserved seat will be released to other students. You can enroll again only if seats remain and the deadline hasn’t passed.</p>
      </Modal>
    </>
  );
}
