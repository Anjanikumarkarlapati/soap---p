"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ApiError, useStore } from "@/lib/store";
import { fmtDate, fmtMoney } from "@/lib/data";
import { Alert, EmptyState, PageHeader, Spinner, StatusBadge } from "@/components/ui";

export default function PaymentPage() {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const { user, enrollments, courses, payments, pay, toast } = useStore();
  const [simulate, setSimulate] = useState<"success" | "fail">("success");
  const [error, setError] = useState("");
  const [timedOut, setTimedOut] = useState(false);

  const enr = enrollments.find((e) => e.id === enrollmentId && e.studentId === user!.id);
  if (!enr) return <EmptyState title="Enrollment not found" body="This payment link doesn’t match any of your enrollments." action={<Link href="/student/enrollments" className="btn-primary">My enrollments</Link>} />;

  const course = courses.find((c) => c.id === enr.courseId)!;
  const attempts = payments.filter((p) => p.enrollmentId === enr.id);
  const latest = attempts[0];
  const paid = attempts.find((p) => p.status === "SUCCEEDED");
  const processing = latest?.status === "PROCESSING";
  const state = paid ? "success" : processing ? "processing" : timedOut ? "timeout" : latest?.status === "FAILED" ? "failed" : enr.status === "PENDING" ? "ready" : "closed";

  async function submit() {
    if (processing || paid) return; // guard against double submission
    setError(""); setTimedOut(false);
    try {
      const p = await pay(enr!.id, simulate);
      toast(p.status === "SUCCEEDED" ? `Payment received — ${course.code} confirmed` : "Payment was declined", p.status === "SUCCEEDED" ? "success" : "error");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message); else setTimedOut(true);
    }
  }

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
        <Link href="/student/enrollments" className="hover:text-primary">My enrollments</Link> <span aria-hidden>/</span> <span className="text-text">Payment</span>
      </nav>
      <PageHeader title={paid ? "Payment receipt" : "Tuition payment"} subtitle={`${course.code} · ${course.title}`} />

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card p-6 lg:col-span-3" aria-live="polite">
          {state === "ready" && (
            <>
              <h2 className="h3">Complete your payment</h2>
              <p className="mt-1 text-sm text-muted">You’ll be redirected to our secure payment provider. AcademiaX never stores card details.</p>
              {error && <div className="mt-4"><Alert tone="error" title="Payment couldn’t start">{error}</Alert></div>}
              <fieldset className="mt-6 rounded-md border border-dashed border-border p-4">
                <legend className="px-1 text-[13px] font-medium">Demo: simulate provider result</legend>
                <div className="flex flex-wrap gap-4 text-sm">
                  {(["success", "fail"] as const).map((v) => (
                    <label key={v} className="flex items-center gap-2">
                      <input type="radio" name="sim" value={v} checked={simulate === v} onChange={() => setSimulate(v)} className="accent-primary" />
                      {v === "success" ? "Payment approved" : "Payment declined"}
                    </label>
                  ))}
                </div>
              </fieldset>
              <button className="btn-primary mt-6 w-full sm:w-auto" onClick={submit}>Pay {fmtMoney(course.fee)}</button>
            </>
          )}

          {state === "processing" && (
            <div className="flex flex-col items-center py-10 text-center">
              <span className="text-primary"><Spinner /></span>
              <h2 className="h3 mt-4">Processing your payment…</h2>
              <p className="mt-1 text-sm text-muted">Please don’t close this page or pay again. Reference {latest!.id}.</p>
            </div>
          )}

          {state === "success" && (
            <div className="space-y-5">
              <Alert tone="success" title="Payment successful — enrollment confirmed">You’re enrolled in {course.code}. A receipt has been sent to {user!.email}.</Alert>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div><dt className="caption">Amount paid</dt><dd className="text-lg font-semibold">{fmtMoney(paid!.amount)}</dd></div>
                <div><dt className="caption">Paid on</dt><dd>{fmtDate(paid!.paidAt!)}</dd></div>
                <div><dt className="caption">Payment reference</dt><dd className="font-mono">{paid!.providerReference}</dd></div>
                <div><dt className="caption">Payment ID</dt><dd className="font-mono">{paid!.id}</dd></div>
                <div><dt className="caption">Enrollment</dt><dd className="flex items-center gap-2 font-mono">{enr.id} <StatusBadge status={enr.status} /></dd></div>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Link href="/student/enrollments" className="btn-primary">View my enrollments</Link>
                <button className="btn-secondary" onClick={() => window.print()}>Print receipt</button>
              </div>
            </div>
          )}

          {state === "failed" && (
            <div className="space-y-5">
              <Alert tone="error" title="Payment declined">
                Your payment {latest!.id} didn’t go through and you were not charged. Your seat reservation was released.
              </Alert>
              <p className="text-sm text-muted">If seats are still available you can enroll again and use a different payment method.</p>
              <Link href={`/student/courses/${course.id}`} className="btn-primary">Return to course</Link>
            </div>
          )}

          {state === "timeout" && (
            <div className="space-y-5">
              <Alert tone="warning" title="We’re verifying your payment status">
                The provider didn’t respond in time. Don’t pay again — check back in a few minutes. Contact support if the status doesn’t update.
              </Alert>
              <button className="btn-secondary" onClick={() => setTimedOut(false)}>Check status</button>
            </div>
          )}

          {state === "closed" && (
            <Alert tone="info" title="No payment due">This enrollment is {enr.status.toLowerCase()} and can’t be paid.</Alert>
          )}
        </section>

        <aside className="card h-fit p-6 lg:col-span-2">
          <h2 className="h3">Order summary</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Course</dt><dd className="font-medium">{course.code}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Schedule</dt><dd className="text-right">{course.schedule}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Enrollment</dt><dd className="font-mono text-xs">{enr.id}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Status</dt><dd><StatusBadge status={enr.status} /></dd></div>
            <div className="flex justify-between border-t border-border pt-3 text-base"><dt className="font-semibold">Total due</dt><dd className="font-bold">{paid ? fmtMoney(0) : fmtMoney(course.fee)}</dd></div>
          </dl>
          {attempts.length > 0 && (
            <>
              <h3 className="mt-6 text-[13px] font-medium">Payment attempts</h3>
              <ul className="mt-2 space-y-2">
                {attempts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-xs"><span className="font-mono">{p.id}</span><StatusBadge status={p.status} /></li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
