"use client";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { fmtDate, isClosed } from "@/lib/data";
import { AvailabilityBadge, CapacityBar, EmptyState, PageHeader, Stat, StatusBadge, CellGrid } from "@/components/ui";

export default function InstructorDashboard() {
  const { user, courses, enrollments } = useStore();
  const mine = courses.filter((c) => c.instructorId === user!.id);
  const seats = mine.reduce((s, c) => s + c.capacity, 0);
  const filled = mine.reduce((s, c) => s + c.enrolledCount, 0);
  const recent = enrollments.filter((e) => mine.some((c) => c.id === e.courseId)).slice(0, 5);

  return (
    <>
      <PageHeader title="Instructor dashboard" subtitle={`${user!.name} · Fall 2026`} actions={<Link href="/instructor/courses/new" className="btn-primary">+ Create course</Link>} />
      <CellGrid className="sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="My courses" value={mine.length} hint={`${mine.filter((c) => c.status === "ACTIVE").length} active`} />
        <Stat label="Students enrolled" value={filled} tone="success" hint={`of ${seats} total seats`} />
        <Stat label="Capacity utilization" value={`${seats ? Math.round((filled / seats) * 100) : 0}%`} tone="info" />
        <Stat label="Open for enrollment" value={mine.filter((c) => !isClosed(c)).length} tone="warning" hint="Deadline not yet passed" />
      </CellGrid>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3" aria-labelledby="cap">
          <div className="mb-3 flex items-center justify-between"><h2 id="cap" className="h2">Enrollment by course</h2><Link href="/instructor/courses" className="text-sm font-medium text-primary hover:underline">Manage</Link></div>
          {mine.length === 0 ? (
            <EmptyState title="No courses assigned" body="Create your first course to open enrollment." action={<Link href="/instructor/courses/new" className="btn-primary">Create course</Link>} />
          ) : (
            <ul className="card divide-y divide-border">
              {mine.map((c) => (
                <li key={c.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_12rem] sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{c.code}</span><AvailabilityBadge course={c} /></div>
                    <p className="text-sm text-muted">{c.title}</p>
                    <p className="caption mt-1">Deadline {fmtDate(c.enrollmentDeadline)}</p>
                  </div>
                  <CapacityBar course={c} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="lg:col-span-2" aria-labelledby="rec">
          <div className="mb-3 flex items-center justify-between"><h2 id="rec" className="h2">Recent enrollments</h2><Link href="/instructor/enrollments" className="text-sm font-medium text-primary hover:underline">View all</Link></div>
          <ul className="card divide-y divide-border">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 p-4">
                <div><p className="text-sm font-medium">{courses.find((c) => c.id === e.courseId)?.code}</p><p className="caption font-mono">{e.id}</p></div>
                <StatusBadge status={e.status} />
              </li>
            ))}
            {recent.length === 0 && <li className="p-4 text-sm text-muted">No enrollments yet.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
