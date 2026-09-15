"use client";
// Shared by Instructor and Admin areas.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, useStore } from "@/lib/store";
import { Course, Enrollment, fmtDate, fmtMoney } from "@/lib/data";
import { Alert, AvailabilityBadge, CapacityBar, Spinner, StatusBadge, Table } from "./ui";

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function CourseForm({ course, backHref }: { course?: Course; backHref: string }) {
  const { user, users, saveCourse, toast } = useStore();
  const router = useRouter();
  const instructors = users.filter((u) => u.role === "INSTRUCTOR");
  const [f, setF] = useState({
    code: course?.code ?? "", title: course?.title ?? "", description: course?.description ?? "",
    department: course?.department ?? "", instructorId: course?.instructorId ?? (user!.role === "INSTRUCTOR" ? user!.id : instructors[0]?.id ?? ""),
    capacity: String(course?.capacity ?? 30), fee: String(course?.fee ?? 1000),
    enrollmentDeadline: course ? toLocalInput(course.enrollmentDeadline) : "",
    schedule: course?.schedule ?? "", mode: course?.mode ?? "In person", semester: course?.semester ?? "Fall 2026", status: course?.status ?? "ACTIVE",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!/^[A-Z]{2,5}\d{3}$/i.test(f.code.trim())) errs.code = "Use a code like CS101 (2–5 letters + 3 digits).";
    if (f.title.trim().length < 3) errs.title = "Enter a course title.";
    if (!f.department.trim()) errs.department = "Enter a department.";
    if (!(Number(f.capacity) >= 1 && Number.isInteger(Number(f.capacity)))) errs.capacity = "Capacity must be a whole number of at least 1.";
    else if (course && Number(f.capacity) < course.enrolledCount) errs.capacity = `Can’t be lower than ${course.enrolledCount} already enrolled.`;
    if (!(Number(f.fee) >= 0)) errs.fee = "Enter a valid tuition amount.";
    if (!f.enrollmentDeadline) errs.enrollmentDeadline = "Choose an enrollment deadline.";
    if (!f.schedule.trim()) errs.schedule = "Describe when the course meets.";
    setErrors(errs); setFormError("");
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const saved = await saveCourse({
        ...f, id: course?.id, code: f.code.trim().toUpperCase(), capacity: Number(f.capacity), fee: Number(f.fee),
        enrollmentDeadline: new Date(f.enrollmentDeadline).toISOString(), mode: f.mode as Course["mode"], status: f.status as Course["status"],
      });
      toast(`${saved.code} ${course ? "updated" : "created"}`, "success");
      router.push(backHref);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn’t save the course. Try again.");
    } finally { setBusy(false); }
  }

  const field = (k: keyof typeof f, label: string, input: React.ReactNode, span = "sm:col-span-1") => (
    <div className={span}>
      <label htmlFor={k} className="label">{label}</label>
      {input}
      {errors[k] && <p id={`${k}-err`} className="mt-1 text-xs text-error">{errors[k]}</p>}
    </div>
  );
  const inp = (k: keyof typeof f, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input id={k} className="input" value={f[k]} onChange={set(k)} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `${k}-err` : undefined} {...props} />
  );

  return (
    <form onSubmit={submit} noValidate className="card space-y-8 p-6">
      {formError && <Alert tone="error" title="Couldn’t save course">{formError}</Alert>}
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="h3 mb-4">Course information</legend>
        {field("code", "Course code", inp("code", { placeholder: "CS101" }))}
        {field("department", "Department", inp("department", { placeholder: "Computer Science" }))}
        {field("title", "Title", inp("title"), "sm:col-span-2")}
        {field("description", "Description", <textarea id="description" rows={4} className="input" value={f.description} onChange={set("description")} />, "sm:col-span-2")}
        {user!.role === "ADMIN" && field("instructorId", "Instructor",
          <select id="instructorId" className="input" value={f.instructorId} onChange={set("instructorId")}>{instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>)}
        {field("status", "Status",
          <select id="status" className="input" value={f.status} onChange={set("status")}><option value="ACTIVE">Active</option><option value="DRAFT">Draft</option><option value="ARCHIVED">Archived</option></select>)}
      </fieldset>
      <fieldset className="grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
        <legend className="h3 mb-4 pt-6">Schedule, capacity & tuition</legend>
        {field("schedule", "Meeting times", inp("schedule", { placeholder: "Mon, Wed · 09:00–10:30" }))}
        {field("mode", "Delivery mode",
          <select id="mode" className="input" value={f.mode} onChange={set("mode")}><option>In person</option><option>Online</option><option>Hybrid</option></select>)}
        {field("capacity", "Seat capacity", inp("capacity", { type: "number", min: course?.enrolledCount ?? 1, inputMode: "numeric" }))}
        {field("fee", "Tuition (USD)", inp("fee", { type: "number", min: 0, step: "0.01", inputMode: "decimal" }))}
        {field("enrollmentDeadline", "Enrollment deadline", inp("enrollmentDeadline", { type: "datetime-local" }))}
        {field("semester", "Semester", inp("semester"))}
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-6">
        <Link href={backHref} className="btn-secondary">Cancel</Link>
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? <><Spinner /> Saving…</> : course ? "Save changes" : "Create course"}</button>
      </div>
    </form>
  );
}

export function CoursesTable({ list, editBase }: { list: Course[]; editBase: string }) {
  const { users } = useStore();
  return (
    <Table head={["Course", "Instructor", "Capacity", "Tuition", "Deadline", "Status", ""]} empty={list.length === 0}>
      {list.map((c) => (
        <tr key={c.id} className="hover:bg-slate-50">
          <td className="px-4 py-3"><span className="font-medium">{c.code}</span><p className="caption">{c.title}</p></td>
          <td className="px-4 py-3 text-muted">{users.find((u) => u.id === c.instructorId)?.name}</td>
          <td className="w-48 px-4 py-3"><CapacityBar course={c} /></td>
          <td className="px-4 py-3">{fmtMoney(c.fee)}</td>
          <td className="px-4 py-3 text-muted">{fmtDate(c.enrollmentDeadline)}</td>
          <td className="px-4 py-3"><div className="flex flex-col items-start gap-1"><StatusBadge status={c.status} /><AvailabilityBadge course={c} /></div></td>
          <td className="px-4 py-3 text-right"><Link href={`${editBase}/${c.id}/edit`} className="btn-secondary px-3 py-1.5">Edit</Link></td>
        </tr>
      ))}
    </Table>
  );
}

export function EnrollmentsTable({ list }: { list: Enrollment[] }) {
  const { users, courses, payments } = useStore();
  return (
    <Table head={["Enrollment", "Student", "Course", "Reserved", "Payment", "Status"]} empty={list.length === 0}>
      {list.map((e) => {
        const s = users.find((u) => u.id === e.studentId), c = courses.find((x) => x.id === e.courseId);
        const p = payments.find((x) => x.enrollmentId === e.id);
        return (
          <tr key={e.id} className="hover:bg-slate-50">
            <td className="px-4 py-3 font-mono text-xs">{e.id}</td>
            <td className="px-4 py-3"><span className="font-medium">{s?.name}</span><p className="caption">{s?.email}</p></td>
            <td className="px-4 py-3">{c?.code}<p className="caption">{c?.title}</p></td>
            <td className="px-4 py-3 text-muted">{fmtDate(e.reservedAt)}</td>
            <td className="px-4 py-3">{p ? <StatusBadge status={p.status} /> : <span className="caption">—</span>}</td>
            <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
          </tr>
        );
      })}
    </Table>
  );
}

export function SearchBar({ value, onChange, label, children }: { value: string; onChange: (v: string) => void; label: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="min-w-60 flex-1">
        <label htmlFor="search" className="label">{label}</label>
        <input id="search" type="search" className="input" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
      {children}
    </div>
  );
}
