"use client";
import { useStore } from "@/lib/store";
import { fmtDate } from "@/lib/data";
import { Badge, PageHeader, StatusBadge } from "@/components/ui";

export default function Profile() {
  const { user } = useStore();
  const u = user!;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile" />
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <span aria-hidden className="grid size-16 place-items-center rounded-full bg-slate-800 text-xl font-semibold text-white">{u.name.split(" ").map((s) => s[0]).slice(-2).join("")}</span>
          <div><h2 className="h2">{u.name}</h2><p className="text-sm text-muted">{u.email}</p></div>
        </div>
        <dl className="mt-6 grid gap-4 border-t border-border pt-6 text-sm sm:grid-cols-2">
          <div><dt className="caption">Role</dt><dd className="mt-1"><Badge tone="primary">{u.role}</Badge></dd></div>
          <div><dt className="caption">Account status</dt><dd className="mt-1"><StatusBadge status={u.status} /></dd></div>
          <div><dt className="caption">User ID</dt><dd className="mt-1 font-mono">{u.id}</dd></div>
          <div><dt className="caption">Member since</dt><dd className="mt-1">{fmtDate(u.createdAt)}</dd></div>
        </dl>
        <p className="caption mt-6 border-t border-border pt-4">Name and email are managed by the registrar. Contact support to request changes.</p>
      </div>
    </div>
  );
}
