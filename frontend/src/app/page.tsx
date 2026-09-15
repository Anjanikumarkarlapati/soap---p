"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStore } from "@/lib/store";

const HOME = { STUDENT: "/student", INSTRUCTOR: "/instructor", ADMIN: "/admin" } as const;

export default function Root() {
  const { ready, user } = useStore();
  const router = useRouter();
  useEffect(() => { if (ready) router.replace(user ? HOME[user.role] : "/login"); }, [ready, user, router]);
  return <div className="grid min-h-screen place-items-center text-sm text-muted" role="status">Loading…</div>;
}
