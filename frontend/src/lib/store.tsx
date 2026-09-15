"use client";
// Data layer for the UI. Two interchangeable implementations with the same shape:
//  - API mode (NEXT_PUBLIC_API_URL set): talks to the Spring Cloud Gateway.
//  - Demo mode (unset): runs the PRD business rules in the browser so the UI works without a backend.
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

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
const KEY = "academiax-demo-v2";
const seed = (): Db => ({ users: seedUsers, courses: seedCourses, enrollments: seedEnrollments, payments: seedPayments, audit: [], sessionId: null });
const rid = (p: string) => `${p}-${Math.floor(10000 + Math.random() * 89999)}`;
const now = () => new Date().toISOString();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const DEMO_PASSWORD = "password123";

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return { toasts, toast };
}

function useDemoStoreValue() {
  const [db, setDb] = useState<Db>(seed);
  const [ready, setReady] = useState(false);
  const { toasts, toast } = useToasts();
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

// ---------------------------------------------------------------------------------------------
// API mode
// ---------------------------------------------------------------------------------------------

type ApiCourse = Course & { instructorName: string; seatsRemaining: number };
type ApiEnrollment = { id: string; studentId: string; studentName: string; studentEmail: string; courseId: string; status: Enrollment["status"]; reservedAt: string; confirmedAt?: string | null };
type Session = { token: string; user: User };
type Data = Omit<Db, "sessionId">;

const SESSION_KEY = "academiax-session-v1";
const emptyData: Data = { users: [], courses: [], enrollments: [], payments: [], audit: [] };

function useApiStoreValue() {
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<Data>(emptyData);
  const [ready, setReady] = useState(false);
  const { toasts, toast } = useToasts();
  const sessionRef = useRef<Session | null>(null);
  const dataRef = useRef<Data>(emptyData);

  const put = useCallback((next: Data | ((d: Data) => Data)) => {
    dataRef.current = typeof next === "function" ? next(dataRef.current) : next;
    setData(dataRef.current);
  }, []);

  const endSession = useCallback(() => {
    sessionRef.current = null;
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    setSession(null);
    put(emptyData);
  }, [put]);

  const call = useCallback(async <T,>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> => {
    const { idempotencyKey, ...rest } = init;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const s = sessionRef.current;
    if (s) headers.Authorization = `Bearer ${s.token}`;
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    let res: Response;
    try {
      res = await fetch(API_URL + path, { ...rest, headers });
    } catch {
      throw new Error("The service is unreachable."); // not an ApiError: pages show their retry / verify state
    }
    if (res.status === 401 && s) endSession(); // expired or revoked token
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new ApiError(res.status, body?.message ?? "Something went wrong. Please try again.");
    }
    return res.json() as Promise<T>;
  }, [endSession]);

  const load = useCallback(async (u: User) => {
    const get = <T,>(p: string) => call<T>(p);
    const [courses, enrollments, payments, people, audit] = await Promise.all([
      get<ApiCourse[]>("/api/courses"),
      get<ApiEnrollment[]>(u.role === "STUDENT" ? "/api/enrollments/me" : "/api/enrollments"),
      u.role === "INSTRUCTOR" ? Promise.resolve([] as Payment[]) : get<Payment[]>(u.role === "STUDENT" ? "/api/payments/me" : "/api/payments"),
      u.role === "ADMIN" ? get<User[]>("/api/users") : u.role === "INSTRUCTOR" ? get<User[]>("/api/users/instructors") : Promise.resolve([] as User[]),
      u.role === "ADMIN"
        ? Promise.all(["users", "courses", "enrollments", "payments"].map((s) => get<AuditEvent[]>(`/api/${s}/audit?size=50`)))
            .then((all) => all.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
        : Promise.resolve([] as AuditEvent[]),
    ]);
    // Pages resolve names through `users`; non-admins can't list accounts, so fill in from course/enrollment snapshots.
    const users = new Map<string, User>([...people, u].map((x) => [x.id, x]));
    const add = (x: User) => { if (!users.has(x.id)) users.set(x.id, x); };
    courses.forEach((c) => add({ id: c.instructorId, name: c.instructorName, email: "", role: "INSTRUCTOR", status: "ACTIVE", createdAt: c.enrollmentDeadline }));
    enrollments.forEach((e) => add({ id: e.studentId, name: e.studentName, email: e.studentEmail, role: "STUDENT", status: "ACTIVE", createdAt: e.reservedAt }));
    put({
      users: [...users.values()],
      courses: courses.map((c) => ({ ...c, fee: Number(c.fee) })),
      enrollments: enrollments.map((e) => ({ id: e.id, studentId: e.studentId, courseId: e.courseId, status: e.status, reservedAt: e.reservedAt, confirmedAt: e.confirmedAt ?? undefined, idempotencyKey: "" })),
      payments: payments.map((p) => ({ ...p, amount: Number(p.amount), providerReference: p.providerReference ?? undefined, paidAt: p.paidAt ?? undefined })),
      audit,
    });
  }, [call, put]);

  const refresh = useCallback(() => (sessionRef.current ? load(sessionRef.current.user) : Promise.resolve()), [load]);

  useEffect(() => {
    Promise.resolve().then(async () => {
      try {
        const s: Session | null = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
        if (s) {
          sessionRef.current = s;
          setSession(s);
          await load(s.user);
        }
      } catch { /* bad or expired session: start signed out */ }
      setReady(true);
    });
  }, [load]);

  async function login(email: string, password: string): Promise<User> {
    const r = await call<{ accessToken: string; user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    const s = { token: r.accessToken, user: r.user };
    sessionRef.current = s;
    // ponytail: bearer token in localStorage is readable by injected scripts; move to an httpOnly cookie via a BFF route for production.
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* ignore */ }
    await load(s.user);
    setSession(s);
    return s.user;
  }

  async function enroll(courseId: string, idempotencyKey: string): Promise<Enrollment> {
    const e = await call<ApiEnrollment>("/api/enrollments", { method: "POST", body: JSON.stringify({ courseId }), idempotencyKey });
    await refresh();
    return { id: e.id, studentId: e.studentId, courseId: e.courseId, status: e.status, reservedAt: e.reservedAt, idempotencyKey };
  }

  async function pay(enrollmentId: string, simulate: "success" | "fail"): Promise<Payment> {
    const key = crypto.randomUUID();
    const enrollment = dataRef.current.enrollments.find((e) => e.id === enrollmentId);
    const fee = dataRef.current.courses.find((c) => c.id === enrollment?.courseId)?.fee ?? 0;
    // Optimistic PROCESSING row so the page shows progress and blocks a second submit while the charge runs.
    const temp: Payment = { id: `processing-${key.slice(0, 8)}`, enrollmentId, amount: fee, currency: "USD", status: "PROCESSING", createdAt: now() };
    put((d) => ({ ...d, payments: [temp, ...d.payments] }));
    try {
      const p = await call<Payment>("/api/payments", {
        method: "POST", idempotencyKey: key,
        body: JSON.stringify({ enrollmentId, simulate: simulate === "success" ? "SUCCESS" : "DECLINE" }),
      });
      await refresh();
      return { ...p, amount: Number(p.amount) };
    } catch (err) {
      put((d) => ({ ...d, payments: d.payments.filter((x) => x.id !== temp.id) }));
      if (err instanceof ApiError) await refresh().catch(() => {});
      throw err;
    }
  }

  function cancelEnrollment(id: string) {
    call(`/api/enrollments/${id}/cancel`, { method: "POST" })
      .then(refresh)
      .catch((err: Error) => toast(err.message, "error"));
  }

  async function saveCourse(input: Omit<Course, "id" | "enrolledCount"> & { id?: string }): Promise<Course> {
    const existing = dataRef.current.courses.find((c) => c.id === input.id);
    const body = {
      code: input.code, title: input.title, description: input.description, department: input.department,
      instructorId: input.instructorId, capacity: input.capacity, fee: input.fee, enrollmentDeadline: input.enrollmentDeadline,
      schedule: input.schedule, mode: input.mode, semester: input.semester, status: input.status,
      image: input.image ?? existing?.image ?? null,
    };
    const c = await call<ApiCourse>(input.id ? `/api/courses/${input.id}` : "/api/courses", { method: input.id ? "PUT" : "POST", body: JSON.stringify(body) });
    await refresh();
    return { ...c, fee: Number(c.fee) };
  }

  function setUserStatus(id: string, status: User["status"]) {
    call(`/api/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) })
      .then(refresh)
      .catch((err: Error) => toast(err.message, "error"));
  }

  function resetDemo() { toast("Demo reset isn't available when connected to the backend.", "info"); }

  return { ...data, sessionId: session?.user.id ?? null, ready, user: session?.user ?? null, toasts, toast, login, logout: endSession, enroll, pay, cancelEnrollment, saveCourse, setUserStatus, resetDemo };
}

const useStoreValue: typeof useDemoStoreValue = API_URL ? useApiStoreValue : useDemoStoreValue;

const Ctx = createContext<ReturnType<typeof useDemoStoreValue> | null>(null);
export function Providers({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={useStoreValue()}>{children}</Ctx.Provider>;
}
export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be inside <Providers>");
  return v;
}
