"use client";
import Image from "next/image";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { courseImage, fmtDate, fmtMoney, isClosed, seatsLeft } from "@/lib/data";
import { Alert, AvailabilityBadge, EmptyState, PageHeader, Stat, StatusBadge, CellGrid } from "@/components/ui";

export default function StudentDashboard() {
  const { user, enrollments, courses, payments, users } = useStore();
  const mine = enrollments.filter((e) => e.studentId === user!.id);
  const course = (id: string) => courses.find((c) => c.id === id)!;
  const pending = mine.filter((e) => e.status === "PENDING");
  const confirmed = mine.filter((e) => e.status === "CONFIRMED");
  const paid = payments.filter((p) => p.status === "SUCCEEDED" && mine.some((e) => e.id === p.enrollmentId)).reduce((s, p) => s + p.amount, 0);
  const closingSoon = courses
    .filter((c) => c.status === "ACTIVE" && !isClosed(c) && seatsLeft(c) > 0 && !mine.some((e) => e.courseId === c.id && e.status !== "CANCELLED" && e.status !== "FAILED"))
    .sort((a, b) => a.enrollmentDeadline.localeCompare(b.enrollmentDeadline))
    .slice(0, 3);

  return (
    <>
      <PageHeader title={`Welcome back, ${user!.name.split(" ")[0]}`} subtitle="Fall 2026 registration"
        actions={<Link href="/student/courses" className="btn-primary">Browse courses</Link>} />

      {pending.length > 0 && (
        <div className="mb-6 space-y-3">
          {pending.map((e) => (
            <Alert key={e.id} tone="warning" title={`Payment pending for ${course(e.courseId).code}`}
              action={<Link href={`/student/pay/${e.id}`} className="btn-primary">Proceed to payment</Link>}>
              Your seat is reserved. Pay {fmtMoney(course(e.courseId).fee)} to confirm enrollment {e.id}.
            </Alert>
          ))}
        </div>
      )}

      <CellGrid className="sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Confirmed courses" value={confirmed.length} tone="success" hint="Enrollment complete" />
        <Stat label="Awaiting payment" value={pending.length} tone="warning" hint={pending.length ? "Seats held for you" : "Nothing due"} />
        <Stat label="Tuition paid" value={fmtMoney(paid)} tone="primary" hint="This semester" />
        <Stat label="Open courses" value={courses.filter((c) => !isClosed(c) && seatsLeft(c) > 0).length} tone="info" hint="Available to enroll" />
      </CellGrid>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3" aria-labelledby="my-enr">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="my-enr" className="h2">My enrollments</h2>
            <Link href="/student/enrollments" className="text-sm font-medium text-primary hover:underline">View all</Link>
          </div>
          {mine.length === 0 ? (
            <EmptyState title="No enrollments yet" body="Browse the catalog to find courses for this semester." action={<Link href="/student/courses" className="btn-primary">Browse courses</Link>} />
          ) : (
            <ul className="card divide-y divide-border">
              {mine.slice(0, 5).map((e) => {
                const c = course(e.courseId);
                return (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 p-4">
                    <span className="rounded-sm bg-blue-50 px-2 py-0.5 text-xs font-semibold text-primary">{c.code}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p className="caption">{c.schedule} · {e.id}</p>
                    </div>
                    <StatusBadge status={e.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="lg:col-span-2" aria-labelledby="closing">
          <h2 id="closing" className="h2 mb-3">Deadlines approaching</h2>
          <ul className="space-y-3">
            {closingSoon.map((c) => (
              <li key={c.id}>
                <Link href={`/student/courses/${c.id}`} className="card flex gap-4 p-3 hover:bg-paper/5">
                  <div className="relative aspect-square w-24 shrink-0 overflow-hidden">
                    <Image src={courseImage(c)} alt="" fill sizes="96px" className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="mono-label font-bold">{c.code}</p>
                      <AvailabilityBadge course={c} />
                    </div>
                    <p className="mono-label mt-1 truncate">{c.title}</p>
                    <p className="caption mt-1 truncate">{users.find((u) => u.id === c.instructorId)?.name}</p>
                    <p className="mono-label mt-1 text-[12px] text-warning">Closes {fmtDate(c.enrollmentDeadline)}</p>
                  </div>
                </Link>
              </li>
            ))}
            {closingSoon.length === 0 && <li className="caption">No open courses closing soon.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
