"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Role } from "@/lib/data";
import { Toasts } from "@/components/ui";

const NAV: Record<Role, { href: string; label: string }[]> = {
  STUDENT: [
    { href: "/student", label: "Dashboard" },
    { href: "/student/courses", label: "Courses" },
    { href: "/student/enrollments", label: "My Enrollments" },
    { href: "/student/payments", label: "Payments" },
    { href: "/profile", label: "Profile" },
  ],
  INSTRUCTOR: [
    { href: "/instructor", label: "Dashboard" },
    { href: "/instructor/courses", label: "My Courses" },
    { href: "/instructor/courses/new", label: "Create Course" },
    { href: "/instructor/enrollments", label: "Enrollments" },
    { href: "/profile", label: "Profile" },
  ],
  ADMIN: [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/courses", label: "Courses" },
    { href: "/admin/enrollments", label: "Enrollments" },
    { href: "/admin/payments", label: "Payments" },
    { href: "/admin/system", label: "System" },
  ],
};
const HOME: Record<Role, string> = { STUDENT: "/student", INSTRUCTOR: "/instructor", ADMIN: "/admin" };
const AREA: Record<string, Role> = { student: "STUDENT", instructor: "INSTRUCTOR", admin: "ADMIN" };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { ready, user, logout, toasts, enrollments, payments } = useStore();
  const path = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { if (ready && !user) router.replace(`/login?next=${encodeURIComponent(path)}`); }, [ready, user, path, router]);

  if (!ready || !user) {
    return <div className="mono-label grid min-h-screen place-items-center" role="status">Loading your workspace…</div>;
  }

  const required = AREA[path.split("/")[1]];
  const forbidden = required && required !== user.role;
  const nav = NAV[user.role];
  const active = nav.filter((n) => path === n.href || (n.href !== HOME[user.role] && path.startsWith(n.href + "/"))).sort((a, b) => b.href.length - a.href.length)[0];
  const pendingPay = user.role === "STUDENT"
    ? enrollments.filter((e) => e.studentId === user.id && e.status === "PENDING" && !payments.some((p) => p.enrollmentId === e.id && p.status === "PROCESSING")).length
    : 0;
  const initials = user.name.split(" ").map((s) => s[0]).slice(-2).join("");

  const sidebar = (
    <nav aria-label="Primary" className="flex h-full flex-col">
      <Link href={HOME[user.role]} className="block border-b-[0.8px] border-paper px-6 py-6">
        <span className="display block text-[34px]">AcademiaX</span>
        <span className="mono-label mt-1 block text-muted">Digital Learning</span>
      </Link>
      <p className="mono-label px-6 pb-3 pt-6 text-muted">{user.role}</p>
      <ul className="flex-1 border-t-[0.8px] border-soft">
        {nav.map((n) => {
          const on = n === active;
          return (
            <li key={n.href} className="border-b-[0.8px] border-soft">
              <Link href={n.href} aria-current={on ? "page" : undefined}
                className={`flex items-center justify-between gap-3 px-6 py-3.5 font-display text-[17px] uppercase tracking-tight transition-colors ${on ? "bg-paper text-navy" : "hover:bg-paper/10"}`}>
                {n.label}
                {n.label === "My Enrollments" && pendingPay > 0 && (
                  <span className={`font-mono text-xs ${on ? "text-navy" : "text-warning"}`} aria-label={`${pendingPay} awaiting payment`}>[{pendingPay}]</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href="/help" className="block border-t-[0.8px] border-paper px-6 py-4 font-display text-[15px] uppercase tracking-tight hover:bg-paper/10">Help & support</Link>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[272px_1fr]">
      <a href="#main" className="btn-primary sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50">Skip to content</a>
      <aside className="sticky top-0 hidden h-screen border-r-[0.8px] border-paper lg:block">{sidebar}</aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-navy-deep/80" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r-[0.8px] border-paper bg-navy" onClick={(e) => (e.target as HTMLElement).closest("a") && setMenuOpen(false)}>{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b-[0.8px] border-paper bg-navy px-4 sm:px-9">
          <button className="btn-ghost -ml-3 px-3 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen}>☰</button>
          <Link href={HOME[user.role]} className="font-display text-[20px] uppercase tracking-tight">
            <span aria-hidden>⌂ </span>{active?.label ?? "Home"}
          </Link>
          <div className="ml-auto flex items-center gap-1 sm:gap-5">
            <Link href={user.role === "STUDENT" ? "/student/enrollments" : "/notifications"} className="font-display text-[15px] uppercase tracking-tight hover:underline"
              aria-label={`Notifications${pendingPay ? `, ${pendingPay} pending` : ""}`}>
              Alerts{pendingPay > 0 && <span className="ml-1 font-mono text-warning">[{pendingPay}]</span>}
            </Link>
            <Link href="/profile" className="flex items-center gap-2.5 px-2 py-1 hover:bg-paper/10">
              <span aria-hidden className="grid size-9 place-items-center border-[0.8px] border-paper font-mono text-xs font-bold">{initials}</span>
              <span className="hidden text-left leading-tight md:block">
                <span className="mono-label block font-bold">{user.name}</span>
                <span className="mono-label block text-[11px] text-muted">{user.email}</span>
              </span>
            </Link>
            <button className="btn-secondary min-h-9 px-3 py-1 text-xs" onClick={() => { logout(); router.replace("/login"); }}>Sign out</button>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-10 sm:px-9">
          {forbidden ? (
            <div className="mx-auto max-w-lg border-[0.8px] border-paper p-10 text-center">
              <p className="mono-label text-muted">Error: 403</p>
              <h1 className="h1 mt-3">No access</h1>
              <p className="caption mt-4">This area is for {required.toLowerCase()} accounts. You’re signed in as {user.role.toLowerCase()}.</p>
              <Link href={HOME[user.role]} className="btn-primary mt-8">Go to my dashboard</Link>
            </div>
          ) : children}
        </main>

        <footer className="mx-4 mt-10 border-t-[0.8px] border-paper py-8 sm:mx-9">
          <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
            {nav.slice(0, 3).map((n) => (
              <Link key={n.href} href={n.href} className="display text-[clamp(2.25rem,6vw,5rem)] hover:underline">{n.label}</Link>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap justify-between gap-4 font-display text-[clamp(1rem,2vw,1.75rem)] uppercase tracking-tight">
            <span>Made by AcademiaX</span><span>Fall 2026</span><span>©2026</span>
          </div>
        </footer>
      </div>
      <Toasts toasts={toasts} />
    </div>
  );
}
