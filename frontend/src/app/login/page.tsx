"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, DEMO_PASSWORD, useStore } from "@/lib/store";
import { courseImage, fmtMoney, seatsLeft } from "@/lib/data";
import { Alert, CellGrid, Spinner } from "@/components/ui";

const HOME = { STUDENT: "/student", INSTRUCTOR: "/instructor", ADMIN: "/admin" } as const;
const DEMO = [
  { role: "Student", email: "student@academiax.edu" },
  { role: "Instructor", email: "instructor@academiax.edu" },
  { role: "Admin", email: "admin@academiax.edu" },
];

export default function LoginPage() {
  const { login, user, ready, courses } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !user) return;
    const next = new URLSearchParams(location.search).get("next");
    router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : HOME[user.role]);
  }, [ready, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = "Enter a valid email address.";
    if (password.length < 8) errs.password = "Password must be at least 8 characters.";
    setErrors(errs);
    setFormError("");
    if (Object.keys(errs).length) return;
    setBusy(true);
    try { await login(email, password); }
    catch (err) { setFormError(err instanceof ApiError ? err.message : "We couldn’t reach the sign-in service. Try again."); }
    finally { setBusy(false); }
  }

  const featured = courses.filter((c) => c.status === "ACTIVE").slice(0, 6);

  return (
    <div className="px-4 sm:px-9">
      <header className="flex h-16 items-center justify-between">
        <a href="#top" className="font-display text-[20px] uppercase tracking-tight sm:text-[24px]"><span aria-hidden>⌂ </span>Home</a>
        <nav aria-label="Site" className="flex gap-5 font-display text-[16px] uppercase tracking-tight sm:gap-7 sm:text-[24px]">
          <a href="#courses" className="hover:underline">Courses</a>
          <a href="#signin" className="hover:underline">Sign in</a>
        </nav>
      </header>

      <main id="top" className="mx-auto max-w-[1280px]">
        <h1 className="display pb-8 pt-8 text-center text-[clamp(3.5rem,13vw,10rem)] text-white sm:pt-12">AcademiaX</h1>
        <div className="border-t-[0.8px] border-paper py-8 text-center">
          <p className="font-display text-[clamp(0.95rem,1.8vw,1.3rem)] uppercase tracking-tight">
            Find your courses — secure your seat, pay with confidence, every semester.
          </p>
        </div>

        <CellGrid className="md:grid-cols-2">
          <div className="relative min-h-72 p-6 sm:p-10">
            <div className="relative h-full min-h-64 overflow-hidden">
              <Image src="/images/hero-library.jpg" alt="Students studying at long tables in a university library" fill priority sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
            </div>
          </div>

          <section id="signin" aria-labelledby="signin-title" className="flex flex-col justify-center p-6 sm:p-10">
            <p className="mono-label">Fall 2026 registration: open</p>
            <h2 id="signin-title" className="h1 mt-2">Sign in</h2>
            <p className="mono-label mt-2 text-muted">Use your university account to continue</p>

            <form onSubmit={submit} noValidate className="mt-8 space-y-5">
              {formError && <Alert tone="error" title="Sign-in failed">{formError}</Alert>}
              <div>
                <label htmlFor="email" className="label">University email</label>
                <input id="email" type="email" autoComplete="username" className="input" value={email} onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-err" : undefined} placeholder="name@academiax.edu" />
                {errors.email && <p id="email-err" className="mono-label mt-1.5 text-[12px] text-error">{errors.email}</p>}
              </div>
              <div>
                <label htmlFor="password" className="label">Password</label>
                <input id="password" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!errors.password} aria-describedby={errors.password ? "pw-err" : undefined} />
                {errors.password && <p id="pw-err" className="mono-label mt-1.5 text-[12px] text-error">{errors.password}</p>}
              </div>
              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? <><Spinner /> Signing in…</> : "Sign in"}
              </button>
            </form>

            <div className="mt-8 border-t-[0.8px] border-soft pt-5">
              <p className="mono-label font-bold">Demo accounts</p>
              <p className="mono-label text-[12px] text-muted">Password for all: {DEMO_PASSWORD}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {DEMO.map((d) => (
                  <button key={d.role} type="button" className="btn-secondary min-h-9 px-3 py-1 text-xs"
                    onClick={() => { setEmail(d.email); setPassword(DEMO_PASSWORD); setErrors({}); }}>
                    {d.role}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </CellGrid>

        <section id="courses" aria-labelledby="courses-title" className="mt-16">
          <h2 id="courses-title" className="border-y-[0.8px] border-paper py-6 text-center font-display text-[clamp(0.95rem,1.8vw,1.3rem)] uppercase tracking-tight">
            Dive into the catalog — this semester’s courses
          </h2>
          <CellGrid className="mt-8 sm:grid-cols-2">
            {featured.map((c, i) => (
              <a key={c.id} href="#signin" className="group block px-6 pb-8 pt-10 sm:px-16">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image src={courseImage(c)} alt="" fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                </div>
                <p className="mono-label mt-6">Course: {String(i + 1).padStart(2, "0")}</p>
                <p className="mono-label mt-1 font-bold">{c.code} {c.title}</p>
                <p className="mono-label mt-1">{seatsLeft(c)} seats left · {fmtMoney(c.fee)} · {c.mode}</p>
              </a>
            ))}
          </CellGrid>
        </section>
      </main>

      <footer className="mx-auto mt-16 max-w-[1280px] border-t-[0.8px] border-paper py-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8">
          <a href="#courses" className="display text-[clamp(2.5rem,9vw,5.6rem)] hover:underline">Courses</a>
          <a href="#signin" className="display text-[clamp(2.5rem,9vw,5.6rem)] hover:underline">Sign in</a>
          <a href="mailto:registrar@academiax.edu" className="display text-[clamp(2.5rem,9vw,5.6rem)] hover:underline">Contact</a>
        </div>
        <div className="mt-10 flex flex-wrap justify-between gap-4 font-display text-[clamp(1rem,2.2vw,1.75rem)] uppercase tracking-tight">
          <span>Made by AcademiaX</span><span>Digital Learning</span><span>©2026</span>
        </div>
        <p className="mono-label mt-8 text-[11px] text-muted">Photos: Wikimedia Commons contributors — see /images/CREDITS.md</p>
      </footer>
    </div>
  );
}
