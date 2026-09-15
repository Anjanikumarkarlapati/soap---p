// Types mirror the PostgreSQL data model (PRD §10). Seed data stands in for the backend.
export type Role = "STUDENT" | "INSTRUCTOR" | "ADMIN";
export type EnrollmentStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "FAILED";
export type PaymentStatus = "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "EXPIRED";

export interface User { id: string; name: string; email: string; role: Role; status: "ACTIVE" | "SUSPENDED"; createdAt: string }
export interface Course {
  id: string; code: string; title: string; description: string; department: string;
  instructorId: string; capacity: number; enrolledCount: number; fee: number;
  enrollmentDeadline: string; schedule: string; mode: "In person" | "Online" | "Hybrid";
  semester: string; status: "ACTIVE" | "DRAFT" | "ARCHIVED"; image?: string;
}
export interface Enrollment { id: string; studentId: string; courseId: string; status: EnrollmentStatus; reservedAt: string; confirmedAt?: string; idempotencyKey: string }
export interface Payment { id: string; enrollmentId: string; amount: number; currency: "USD"; status: PaymentStatus; providerReference?: string; createdAt: string; paidAt?: string }
export interface AuditEvent { id: string; actorId: string; action: string; entityType: string; entityId: string; correlationId: string; createdAt: string }

const day = 86_400_000;
const inDays = (n: number) => new Date(Date.now() + n * day).toISOString();

export const seedUsers: User[] = [
  { id: "u-s1", name: "Priya Sharma", email: "student@academiax.edu", role: "STUDENT", status: "ACTIVE", createdAt: inDays(-120) },
  { id: "u-s2", name: "Daniel Okafor", email: "daniel@academiax.edu", role: "STUDENT", status: "ACTIVE", createdAt: inDays(-90) },
  { id: "u-s3", name: "Mei Lin", email: "mei@academiax.edu", role: "STUDENT", status: "SUSPENDED", createdAt: inDays(-60) },
  { id: "u-i1", name: "Dr. Alan Reyes", email: "instructor@academiax.edu", role: "INSTRUCTOR", status: "ACTIVE", createdAt: inDays(-400) },
  { id: "u-i2", name: "Prof. Sara Nguyen", email: "sara@academiax.edu", role: "INSTRUCTOR", status: "ACTIVE", createdAt: inDays(-380) },
  { id: "u-a1", name: "Jordan Blake", email: "admin@academiax.edu", role: "ADMIN", status: "ACTIVE", createdAt: inDays(-500) },
];

const c = (o: Omit<Course, "semester" | "status"> & Partial<Course>): Course => ({ semester: "Fall 2026", status: "ACTIVE", ...o });

export const seedCourses: Course[] = [
  c({ id: "c1", image: "/images/lecture-hall.jpg", code: "CS101", title: "Introduction to Programming", department: "Computer Science", instructorId: "u-i1", capacity: 60, enrolledCount: 42, fee: 1200, enrollmentDeadline: inDays(14), schedule: "Mon, Wed · 09:00–10:30", mode: "In person", description: "Foundations of programming using Python: variables, control flow, functions, data structures and problem solving." }),
  c({ id: "c2", image: "/images/data-center.jpg", code: "CS240", title: "Distributed Systems", department: "Computer Science", instructorId: "u-i1", capacity: 40, enrolledCount: 37, fee: 1650, enrollmentDeadline: inDays(5), schedule: "Tue, Thu · 13:00–14:30", mode: "Hybrid", description: "Consistency, replication, consensus and fault tolerance in large-scale service architectures." }),
  c({ id: "c3", image: "/images/math-lecture.jpg", code: "MATH210", title: "Linear Algebra", department: "Mathematics", instructorId: "u-i2", capacity: 50, enrolledCount: 50, fee: 980, enrollmentDeadline: inDays(10), schedule: "Mon, Wed, Fri · 11:00–12:00", mode: "In person", description: "Vector spaces, linear maps, eigenvalues and applications to data and engineering." }),
  c({ id: "c4", image: "/images/finance-exchange.jpg", code: "BUS150", title: "Principles of Finance", department: "Business", instructorId: "u-i2", capacity: 80, enrolledCount: 31, fee: 1100, enrollmentDeadline: inDays(-2), schedule: "Thu · 18:00–21:00", mode: "Online", description: "Time value of money, risk and return, capital budgeting and financial statements." }),
  c({ id: "c5", image: "/images/laptop-notes.jpg", code: "DS320", title: "Machine Learning Fundamentals", department: "Data Science", instructorId: "u-i1", capacity: 35, enrolledCount: 18, fee: 1850, enrollmentDeadline: inDays(21), schedule: "Tue, Thu · 10:00–11:30", mode: "Online", description: "Supervised and unsupervised learning, model evaluation and practical ML workflows." }),
  c({ id: "c6", image: "/images/writing.jpg", code: "ENG105", title: "Academic Writing", department: "English", instructorId: "u-i2", capacity: 25, enrolledCount: 22, fee: 750, enrollmentDeadline: inDays(2), schedule: "Fri · 14:00–16:00", mode: "In person", description: "Argument, structure, citation and revision for university-level writing." }),
];

export const seedEnrollments: Enrollment[] = [
  { id: "ENR-10231", studentId: "u-s1", courseId: "c1", status: "CONFIRMED", reservedAt: inDays(-6), confirmedAt: inDays(-6), idempotencyKey: "seed-1" },
  { id: "ENR-10244", studentId: "u-s1", courseId: "c6", status: "PENDING", reservedAt: inDays(-1), idempotencyKey: "seed-2" },
  { id: "ENR-10198", studentId: "u-s2", courseId: "c2", status: "CONFIRMED", reservedAt: inDays(-9), confirmedAt: inDays(-9), idempotencyKey: "seed-3" },
  { id: "ENR-10177", studentId: "u-s2", courseId: "c5", status: "FAILED", reservedAt: inDays(-12), idempotencyKey: "seed-4" },
];

export const seedPayments: Payment[] = [
  { id: "PAY-50311", enrollmentId: "ENR-10231", amount: 1200, currency: "USD", status: "SUCCEEDED", providerReference: "PRV-8F2K91", createdAt: inDays(-6), paidAt: inDays(-6) },
  { id: "PAY-50290", enrollmentId: "ENR-10198", amount: 1650, currency: "USD", status: "SUCCEEDED", providerReference: "PRV-3LQ7X0", createdAt: inDays(-9), paidAt: inDays(-9) },
  { id: "PAY-50270", enrollmentId: "ENR-10177", amount: 1850, currency: "USD", status: "FAILED", createdAt: inDays(-12) },
];

export const courseImage = (c: Course) => c.image ?? "/images/grace-knox-hall.jpg";
export const fmtMoney = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
export const seatsLeft = (c: Course) => Math.max(0, c.capacity - c.enrolledCount);
export const isClosed = (c: Course) => new Date(c.enrollmentDeadline).getTime() < Date.now();
export const isFull = (c: Course) => seatsLeft(c) === 0;
