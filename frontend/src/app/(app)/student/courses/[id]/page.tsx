"use client";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ApiError, useStore } from "@/lib/store";
import { Enrollment, courseImage, fmtDate, fmtMoney, isClosed, isFull, seatsLeft } from "@/lib/data";
import { Alert, AvailabilityBadge, Badge, CapacityBar, EmptyState, Modal, Spinner, StatusBadge } from "@/components/ui";

export default function CourseDetails() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { courses, users, user, enrollments, enroll, toast } = useStore();
  const course = courses.find((c) => c.id === id);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<Enrollment | null>(null);
  const idemKey = useRef<string>("");

  if (!course) {
    return <EmptyState title="Course not found" body="It may have been removed or the link is incorrect." action={<Link href="/student/courses" className="btn-primary">Back to catalog</Link>} />;
  }

  const instructor = users.find((u) => u.id === course.instructorId);
  const active = enrollments.find((e) => e.studentId === user!.id && e.courseId === course.id && (e.status === "PENDING" || e.status === "CONFIRMED"));
  const closed = isClosed(course), full = isFull(course);
  const blocked = closed ? "Enrollment closed on the deadline." : full ? "This course is full — all seats are taken." : active ? `You’re already enrolled (${active.status}).` : "";

  function openConfirm() {
    idemKey.current = crypto.randomUUID(); // one key per confirmation attempt → retries can't double-book
    setError(null); setDone(null); setOpen(true);
  }

  async function confirm() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const e = await enroll(course!.id, idemKey.current);
      setDone(e);
      toast(`Seat reserved in ${course!.code}`, "success");
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(503, "The enrollment service is temporarily unavailable. Please retry."));
    } finally { setBusy(false); }
  }

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
        <Link href="/student/courses" className="hover:text-primary">Courses</Link> <span aria-hidden>/</span> <span className="text-text">{course.code}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <header className="card p-6">
            <div className="relative mb-6 aspect-[16/9] overflow-hidden">
              <Image src={courseImage(course)} alt={`${course.code} ${course.title}`} fill priority sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm bg-blue-50 px-2 py-0.5 text-sm font-semibold text-primary">{course.code}</span>
              <AvailabilityBadge course={course} />
              <Badge tone="neutral">{course.mode}</Badge>
            </div>
            <h1 className="h1 mt-3">{course.title}</h1>
            <p className="mt-1 text-sm text-muted">{course.department} · {course.semester}</p>
          </header>

          <section className="card p-6" aria-labelledby="ov">
            <h2 id="ov" className="h3">Overview</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{course.description}</p>
          </section>

          <div className="grid gap-6 sm:grid-cols-2">
            <section className="card p-6" aria-labelledby="sc">
              <h2 id="sc" className="h3">Schedule</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div><dt className="caption">Meets</dt><dd>{course.schedule}</dd></div>
                <div><dt className="caption">Semester</dt><dd>{course.semester}</dd></div>
                <div><dt className="caption">Delivery</dt><dd>{course.mode}</dd></div>
              </dl>
            </section>
            <section className="card p-6" aria-labelledby="in">
              <h2 id="in" className="h3">Instructor</h2>
              <div className="mt-3 flex items-center gap-3">
                <span aria-hidden className="grid size-11 place-items-center rounded-full bg-slate-800 text-sm font-semibold text-white">{instructor?.name.split(" ").slice(-2).map((s) => s[0]).join("")}</span>
                <div><p className="text-sm font-medium">{instructor?.name ?? "TBA"}</p><p className="caption">{instructor?.email}</p></div>
              </div>
            </section>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <p className="caption">Tuition</p>
            <p className="text-[32px] font-bold tracking-tight">{fmtMoney(course.fee)}</p>
            <p className="caption">Paid after your seat is reserved</p>

            <div className="my-5 border-t border-border" />
            <p className="mb-2 text-sm font-medium">Availability</p>
            <CapacityBar course={course} />
            <p className="mt-2 text-sm"><span className="font-semibold">{seatsLeft(course)}</span> of {course.capacity} seats remaining</p>

            <div className="my-5 border-t border-border" />
            <p className="text-sm font-medium">Enrollment deadline</p>
            <p className={`text-sm ${closed ? "text-error" : "text-slate-700"}`}>{fmtDate(course.enrollmentDeadline)}{closed && " · passed"}</p>

            <div className="mt-6">
              {active ? (
                <div className="space-y-3">
                  <Alert tone={active.status === "CONFIRMED" ? "success" : "warning"} title={active.status === "CONFIRMED" ? "You’re enrolled" : "Seat reserved"}>
                    Enrollment {active.id} <StatusBadge status={active.status} />
                  </Alert>
                  {active.status === "PENDING" && <Link href={`/student/pay/${active.id}`} className="btn-primary w-full">Proceed to payment</Link>}
                </div>
              ) : (
                <>
                  <button className="btn-primary w-full" disabled={!!blocked} onClick={openConfirm} aria-describedby={blocked ? "why" : undefined}>
                    Enroll in course
                  </button>
                  {blocked && <p id="why" className="mt-2 text-center text-xs text-muted">{blocked}</p>}
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      <Modal open={open} onClose={() => !busy && setOpen(false)} title={done ? "Seat reserved" : "Confirm enrollment"}
        footer={done ? (
          <>
            <button className="btn-secondary" onClick={() => setOpen(false)}>Pay later</button>
            <button className="btn-primary" onClick={() => router.push(`/student/pay/${done.id}`)}>Proceed to payment</button>
          </>
        ) : (
          <>
            <button className="btn-secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
            {!(error && error.status !== 503) && (
              <button className="btn-primary" onClick={confirm} disabled={busy}>{busy ? <><Spinner /> Reserving seat…</> : error ? "Retry" : "Confirm enrollment"}</button>
            )}
          </>
        )}>
        {done ? (
          <div className="space-y-4">
            <Alert tone="success" title={`Your seat in ${course.code} is held`}>Complete payment to confirm your enrollment.</Alert>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="caption">Enrollment ID</dt><dd className="font-mono">{done.id}</dd></div>
              <div><dt className="caption">Status</dt><dd><StatusBadge status={done.status} /></dd></div>
              <div><dt className="caption">Amount due</dt><dd className="font-semibold">{fmtMoney(course.fee)}</dd></div>
            </dl>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <Alert tone="error" title={error.status === 409 ? "Enrollment unavailable" : error.status === 422 ? "Deadline passed" : "Something went wrong"}>{error.message}</Alert>
            )}
            <dl className="divide-y divide-border rounded-md border border-border text-sm">
              {[
                ["Student", `${user!.name} (${user!.email})`],
                ["Course", `${course.code} · ${course.title}`],
                ["Schedule", course.schedule],
                ["Seats remaining", `${seatsLeft(course)} of ${course.capacity}`],
                ["Deadline", fmtDate(course.enrollmentDeadline)],
                ["Tuition", fmtMoney(course.fee)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
              ))}
            </dl>
            <p className="caption">Confirming reserves a seat immediately. Tuition payment is required to confirm your enrollment.</p>
          </div>
        )}
      </Modal>
    </>
  );
}
