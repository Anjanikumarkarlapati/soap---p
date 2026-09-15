"use client";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { fmtDate, fmtMoney } from "@/lib/data";
import { Alert, EmptyState, PageHeader, Stat, StatusBadge, Table, CellGrid } from "@/components/ui";

export default function PaymentHistory() {
  const { user, enrollments, courses, payments } = useStore();
  const mine = enrollments.filter((e) => e.studentId === user!.id);
  const list = payments.filter((p) => mine.some((e) => e.id === p.enrollmentId));
  const due = mine.filter((e) => e.status === "PENDING");
  const courseOf = (enrollmentId: string) => courses.find((c) => c.id === mine.find((e) => e.id === enrollmentId)!.courseId)!;
  const total = list.filter((p) => p.status === "SUCCEEDED").reduce((s, p) => s + p.amount, 0);
  const dueAmount = due.reduce((s, e) => s + courses.find((c) => c.id === e.courseId)!.fee, 0);

  return (
    <>
      <PageHeader title="Payments" subtitle="Tuition payments and receipts" />

      <CellGrid className="mb-6 sm:grid-cols-3">
        <Stat label="Paid this semester" value={fmtMoney(total)} tone="success" />
        <Stat label="Outstanding" value={fmtMoney(dueAmount)} tone={dueAmount ? "warning" : "success"} hint={`${due.length} enrollment${due.length === 1 ? "" : "s"} awaiting payment`} />
        <Stat label="Transactions" value={list.length} tone="info" />
      </CellGrid>

      {due.length > 0 && (
        <div className="mb-6">
          <Alert tone="warning" title="You have tuition due" action={<Link href={`/student/pay/${due[0].id}`} className="btn-primary">Pay {fmtMoney(courses.find((c) => c.id === due[0].courseId)!.fee)}</Link>}>
            Unpaid reservations may be released. Pay to confirm your enrollment.
          </Alert>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState title="No payments yet" body="Payments appear here after you reserve a seat and pay tuition." action={<Link href="/student/courses" className="btn-primary">Browse courses</Link>} />
      ) : (
        <Table head={["Payment", "Course", "Amount", "Reference", "Date", "Status", ""]}>
          {list.map((p) => {
            const c = courseOf(p.enrollmentId);
            return (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">{p.id}</td>
                <td className="px-4 py-3"><span className="font-medium">{c.code}</span><p className="caption">{p.enrollmentId}</p></td>
                <td className="px-4 py-3 font-medium">{fmtMoney(p.amount)}</td>
                <td className="px-4 py-3 font-mono text-xs">{p.providerReference ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{fmtDate(p.paidAt ?? p.createdAt)}</td>
                <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                <td className="px-4 py-3 text-right"><Link href={`/student/pay/${p.enrollmentId}`} className="btn-ghost px-3 py-1.5">Details</Link></td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
