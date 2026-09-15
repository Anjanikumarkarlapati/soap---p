"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Course, courseImage, fmtDate, fmtMoney, isClosed, isFull, seatsLeft } from "@/lib/data";

type Tone = "success" | "warning" | "error" | "info" | "neutral" | "primary";
const toneText: Record<Tone, string> = {
  success: "text-success", warning: "text-warning", error: "text-error",
  info: "text-info", neutral: "text-muted", primary: "text-paper",
};
const icon: Record<Tone, string> = { success: "✓", warning: "!", error: "✕", info: "i", neutral: "•", primary: "•" };

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 border-[0.8px] border-current px-2 py-0.5 font-mono text-[11px] font-bold uppercase leading-5 ${toneText[tone]}`}>
      <span aria-hidden>{icon[tone]}</span>
      {children}
    </span>
  );
}

const statusTone: Record<string, Tone> = {
  CONFIRMED: "success", SUCCEEDED: "success", ACTIVE: "success",
  PENDING: "warning", PROCESSING: "info", DRAFT: "neutral",
  FAILED: "error", EXPIRED: "error", SUSPENDED: "error",
  CANCELLED: "neutral", ARCHIVED: "neutral",
};
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={statusTone[status] ?? "neutral"}>{status}</Badge>;

export function AvailabilityBadge({ course }: { course: Course }) {
  if (isClosed(course)) return <Badge tone="neutral">Closed</Badge>;
  if (isFull(course)) return <Badge tone="error">Full</Badge>;
  const left = seatsLeft(course);
  if (left <= Math.max(3, course.capacity * 0.1)) return <Badge tone="warning">{left} seats left</Badge>;
  return <Badge tone="success">{left} seats open</Badge>;
}

export function Alert({ tone, title, children, action }: { tone: Exclude<Tone, "neutral" | "primary">; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className="flex flex-wrap items-start gap-4 border-[0.8px] border-paper p-4">
      <span aria-hidden className={`grid size-7 shrink-0 place-items-center border-[0.8px] border-current font-mono text-sm font-bold ${toneText[tone]}`}>{icon[tone]}</span>
      <div className="min-w-0 flex-1">
        <p className={`font-display text-[15px] uppercase tracking-tight ${toneText[tone]}`}>{title}</p>
        {children && <div className="mt-1 text-sm text-muted">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Spinner() {
  return <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />;
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal(); // native <dialog> traps focus and closes on Esc
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="modal-title"
      className="m-auto w-[calc(100%-2rem)] max-w-xl border-[0.8px] border-paper bg-navy p-0 text-paper backdrop:bg-navy-deep/80">
      <div className="flex items-center justify-between border-b-[0.8px] border-paper px-6 py-4">
        <h2 id="modal-title" className="h2">{title}</h2>
        <button className="btn-ghost -mr-3 px-3" onClick={onClose} aria-label="Close dialog">✕</button>
      </div>
      <div className="px-6 py-6">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t-[0.8px] border-paper px-6 py-4">{footer}</div>}
    </dialog>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="grid border-[0.8px] border-paper md:grid-cols-2">
      <div className="relative aspect-[4/3] border-b-[0.8px] border-paper md:border-b-0 md:border-r-[0.8px]">
        <Image src="/images/fountain-pen.jpg" alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover p-8" />
      </div>
      <div className="flex flex-col justify-center p-8">
        <h3 className="h2">{title}</h3>
        <p className="caption mt-3">{body}</p>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 border-b-[0.8px] border-paper pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="h1">{title}</h1>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {subtitle && <p className="mt-3 font-display text-[15px] uppercase tracking-tight text-muted">{subtitle}</p>}
    </div>
  );
}

/** Hairline grid: cells share 0.8px borders like the template's item grid. */
export function CellGrid({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`grid border-l-[0.8px] border-t-[0.8px] border-paper [&>*]:border-b-[0.8px] [&>*]:border-r-[0.8px] [&>*]:border-paper ${className}`}>{children}</div>;
}

export function Stat({ label, value, hint, tone = "primary" }: { label: string; value: React.ReactNode; hint?: string; tone?: "primary" | "success" | "warning" | "error" | "info" }) {
  return (
    <div className="p-5">
      <p className="mono-label flex items-center gap-2"><span aria-hidden className={`size-2 bg-current ${toneText[tone]}`} />{label}</p>
      <p className="mt-3 font-display text-[34px] leading-none tracking-[-0.04em]">{value}</p>
      {hint && <p className="caption mt-3">{hint}</p>}
    </div>
  );
}

export function CapacityBar({ course }: { course: Course }) {
  const pct = Math.round((course.enrolledCount / course.capacity) * 100);
  const color = pct >= 100 ? "bg-error" : pct >= 85 ? "bg-warning" : "bg-paper";
  return (
    <div>
      <div className="mono-label mb-1.5 flex justify-between text-[12px] text-muted">
        <span>{course.enrolledCount} / {course.capacity} enrolled</span><span>{pct}%</span>
      </div>
      <div className="h-2.5 border-[0.8px] border-paper" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${course.code} capacity`}>
        <div className={`h-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

export function CourseCard({ course, instructor, href, index }: { course: Course; instructor: string; href: string; index?: number }) {
  const closed = isClosed(course), full = isFull(course);
  return (
    <article className="group flex flex-col">
      <Link href={href} className="block px-6 pt-8 sm:px-10" aria-label={`${course.code} ${course.title}`}>
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image src={courseImage(course)} alt="" fill sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
            className={`object-cover transition-transform duration-500 group-hover:scale-[1.03] ${closed || full ? "opacity-60 grayscale" : ""}`} />
        </div>
      </Link>
      <div className="flex flex-1 flex-col px-6 pb-6 pt-6 sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="mono-label">Course: {index !== undefined ? String(index + 1).padStart(2, "0") : course.code} · {course.code}</p>
          <AvailabilityBadge course={course} />
        </div>
        <h3 className="mono-label mt-2 text-[14px] font-bold">{course.title}</h3>
        <p className="mono-label mt-1 text-muted">{instructor} · {course.department}</p>
        <dl className="mono-label mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
          <div className="col-span-2"><dt className="text-muted">Schedule</dt><dd>{course.schedule} · {course.mode}</dd></div>
          <div><dt className="text-muted">Seats remaining</dt><dd className="font-bold">{seatsLeft(course)} of {course.capacity}</dd></div>
          <div><dt className="text-muted">Tuition</dt><dd className="font-bold">{fmtMoney(course.fee)}</dd></div>
          <div className="col-span-2"><dt className="text-muted">Enrollment deadline</dt><dd className={closed ? "line-through opacity-70" : ""}>{fmtDate(course.enrollmentDeadline)}</dd></div>
        </dl>
        <Link href={href} className={`mt-6 ${closed || full ? "btn-secondary" : "btn-primary"}`}>
          {closed ? "View details · Closed" : full ? "View details · Full" : "View & enroll"}
        </Link>
      </div>
    </article>
  );
}

export function Toasts({ toasts }: { toasts: { id: number; tone: "success" | "error" | "info"; message: string }[] }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(26rem,calc(100%-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-center gap-3 border-[0.8px] border-paper bg-navy-deep px-4 py-3">
          <span aria-hidden className={`font-mono font-bold ${toneText[t.tone]}`}>{icon[t.tone]}</span>
          <span className="mono-label">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto border-[0.8px] border-paper">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="border-b-[0.8px] border-paper">
          <tr>{head.map((h) => <th key={h} scope="col" className="mono-label whitespace-nowrap px-4 py-3 font-bold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y-[0.8px] divide-soft">
          {empty ? <tr><td colSpan={head.length} className="caption px-4 py-12 text-center">Nothing to show yet.</td></tr> : children}
        </tbody>
      </table>
    </div>
  );
}
