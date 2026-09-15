"use client";
// Client-side stand-in for the Gateway → Auth/Course/Enrollment/Payment services.
// Business rules match the PRD so the UI exercises real states; swap these functions
// for fetch() calls to the Spring Cloud Gateway when the backend is up.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  AuditEvent, Course, Enrollment, Payment, User,
  isClosed, seedCourses, seedEnrollments, seedPayments, seedUsers,
} from "./data";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

interface Db { users: User[]; courses: Course[]; enrollments: Enrollment[]; payments: Payment[]; audit: AuditEvent[]; sessionId: string | null }
export interface Toast { id: number; tone: "success" | "error" | "info"; message: string }

const KEY = "academiax-demo-v2";
const seed = (): Db => ({ users: seedUsers, courses: seedCourses, enrollments: seedEnrollments, payments: seedPayments, audit: [], sessionId: null });
const rid = (p: string) => `${p}-${Math.floor(10000 + Math.random() * 89999)}`;
const now = () => new Date().toISOString();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const DEMO_PASSWORD = "password123";

function useStoreValue() {
  const [db, setDb] = useState<Db>(seed);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const ref = useRef(db);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { ref.current = JSON.parse(raw); setDb(ref.current); }
    } catch { /* storage unavailable: run on seed data */ }
    setReady(true);
  }, []);

  // Synchronous commit through a ref so two rapid clicks can't both see the same free seat.
  const commit = useCallback((fn: (d: Db) => Db) => {
    ref.current = fn(ref.current);
    setDb(ref.current);
    try { localStorage.setItem(KEY, JSON.stringify(ref.current)); } catch { /* ignore */ }
  }, []);

  const audit = (d: Db, action: string, entityType: string, entityId: string): Db => ({
    ...d,
    audit: [{ id: rid("AUD"), actorId: d.sessionId ?? "system", action, entityType, entityId, correlationId: crypto.randomUUID(), createdAt: now() }, ...d.audit].slice(0, 200),
  });

  const toast = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const user = db.users.find((u) => u.id === db.sessionId) ?? null;

  async function login(email: string, password: string): Promise<User> {
    await wait(600);
    const u = ref.current.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || password !== DEMO_PASSWORD) throw new ApiError(401, "Email or password is incorrect.");
    if (u.status !== "ACTIVE") throw new ApiError(403, "This account is suspended. Contact the registrar.");
    commit((d) => audit({ ...d, sessionId: u.id }, "LOGIN", "user", u.id));
    return u;
  }

  function logout() { commit((d) => audit({ ...d, sessionId: null }, "LOGOUT", "user", d.sessionId ?? "")); }

  async function enroll(courseId: string, idempotencyKey: string): Promise<Enrollment> {
    await wait(700);
    const d = ref.current;
    const me = d.sessionId!;
    const replay = d.enrollments.find((e) => e.idempotencyKey === idempotencyKey);
    if (replay) return replay;
    const course = d.courses.find((c) => c.id === courseId);
    if (!course || course.status !== "ACTIVE") throw new ApiError(404, "This course is not available.");
    if (isClosed(course)) throw new ApiError(422, `Enrollment for ${course.code} closed on the deadline.`);
    if (d.enrollments.some((e) => e.studentId === me && e.courseId === courseId && (e.status === "PENDING" || e.status === "CONFIRMED")))
      throw new ApiError(409, `You already have an active enrollment in ${course.code}.`);
    if (course.enrolledCount >= course.capacity) throw new ApiError(409, `${course.code} is full. No seats are available.`);
    const e: Enrollment = { id: rid("ENR"), studentId: me, courseId, status: "PENDING", reservedAt: now(), idempotencyKey };
    commit((x) => audit({
      ...x,
      courses: x.courses.map((c) => (c.id === courseId ? { ...c, enrolledCount: c.enrolledCount + 1 } : c)),
      enrollments: [e, ...x.enrollments],
    }, "ENROLLMENT_RESERVED", "enrollment", e.id));
    return e;
  }

  function releaseSeat(d: Db, enrollmentId: string, status: "FAILED" | "CANCELLED"): Db {
    const e = d.enrollments.find((x) => x.id === enrollmentId)!;
    return {
      ...d,
      courses: d.courses.map((c) => (c.id === e.courseId ? { ...c, enrolledCount: Math.max(0, c.enrolledCount - 1) } : c)),
      enrollments: d.enrollments.map((x) => (x.id === enrollmentId ? { ...x, status } : x)),
    };
  }

  async function pay(enrollmentId: string, simulate: "success" | "fail"): Promise<Payment> {
    const d = ref.current;
    const e = d.enrollments.find((x) => x.id === enrollmentId);
    if (!e) throw new ApiError(404, "Enrollment not found.");
    const paid = d.payments.find((p) => p.enrollmentId === enrollmentId && p.status === "SUCCEEDED");
    if (paid) return paid; // already paid: never charge twice
    if (e.status !== "PENDING") throw new ApiError(422, "This enrollment can no longer be paid.");
    const course = d.courses.find((c) => c.id === e.courseId)!;
    const p: Payment = { id: rid("PAY"), enrollmentId, amount: course.fee, currency: "USD", status: "PROCESSING", createdAt: now() };
    commit((x) => ({ ...x, payments: [p, ...x.payments] }));
    await wait(1400);
    if (simulate === "success") {
      const done = { ...p, status: "SUCCEEDED" as const, providerReference: rid("PRV"), paidAt: now() };
      commit((x) => audit({
        ...x,
        payments: x.payments.map((y) => (y.id === p.id ? done : y)),
        enrollments: x.enrollments.map((y) => (y.id === enrollmentId ? { ...y, status: "CONFIRMED", confirmedAt: now() } : y)),
      }, "PAYMENT_SUCCEEDED", "payment", p.id));
      return done;
    }
    const failed = { ...p, status: "FAILED" as const };
    // Compensation: failed payment releases the reserved seat.
    commit((x) => audit(releaseSeat({ ...x, payments: x.payments.map((y) => (y.id === p.id ? failed : y)) }, enrollmentId, "FAILED"), "PAYMENT_FAILED", "payment", p.id));
    return failed;
  }

  function cancelEnrollment(id: string) {
    commit((x) => audit(releaseSeat(x, id, "CANCELLED"), "ENROLLMENT_CANCELLED", "enrollment", id));
  }

  async function saveCourse(input: Omit<Course, "id" | "enrolledCount"> & { id?: string }): Promise<Course> {
    await wait(500);
    const d = ref.current;
    if (d.courses.some((c) => c.code.toUpperCase() === input.code.toUpperCase() && c.id !== input.id))
      throw new ApiError(409, `Course code ${input.code} already exists.`);
    const existing = d.courses.find((c) => c.id === input.id);
    if (existing && input.capacity < existing.enrolledCount)
      throw new ApiError(422, `Capacity can't be lower than the ${existing.enrolledCount} students already enrolled.`);
    const course: Course = existing ? { ...existing, ...input, id: existing.id } : { ...input, id: rid("c"), enrolledCount: 0 };
    commit((x) => audit({
      ...x,
      courses: existing ? x.courses.map((c) => (c.id === course.id ? course : c)) : [course, ...x.courses],
    }, existing ? "COURSE_UPDATED" : "COURSE_CREATED", "course", course.id));
    return course;
  }

  function setUserStatus(id: string, status: User["status"]) {
    commit((x) => audit({ ...x, users: x.users.map((u) => (u.id === id ? { ...u, status } : u)) }, `USER_${status}`, "user", id));
  }

  function resetDemo() { commit(() => ({ ...seed(), sessionId: ref.current.sessionId })); }

  return { ...db, ready, user, toasts, toast, login, logout, enroll, pay, cancelEnrollment, saveCourse, setUserStatus, resetDemo };
}

const Ctx = createContext<ReturnType<typeof useStoreValue> | null>(null);
export function Providers({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={useStoreValue()}>{children}</Ctx.Provider>;
}
export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be inside <Providers>");
  return v;
}
