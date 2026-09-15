"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { fmtDate } from "@/lib/data";
import { Badge, PageHeader, StatusBadge, Table } from "@/components/ui";
import { SearchBar } from "@/components/course-admin";

export default function AdminUsers() {
  const { users, user, setUserStatus, toast } = useStore();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const list = users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()) && (!role || u.role === role));
  return (
    <>
      <PageHeader title="Users" subtitle={`${users.length} accounts`} />
      <SearchBar label="Search by name or email" value={q} onChange={setQ}>
        <div><label htmlFor="role" className="label">Role</label>
          <select id="role" className="input w-40" value={role} onChange={(e) => setRole(e.target.value)}><option value="">All roles</option><option>STUDENT</option><option>INSTRUCTOR</option><option>ADMIN</option></select></div>
      </SearchBar>
      <Table head={["Name", "Role", "Joined", "Status", ""]} empty={list.length === 0}>
        {list.map((u) => (
          <tr key={u.id} className="hover:bg-slate-50">
            <td className="px-4 py-3"><span className="font-medium">{u.name}</span><p className="caption">{u.email}</p></td>
            <td className="px-4 py-3"><Badge tone={u.role === "ADMIN" ? "primary" : u.role === "INSTRUCTOR" ? "info" : "neutral"}>{u.role}</Badge></td>
            <td className="px-4 py-3 text-muted">{fmtDate(u.createdAt)}</td>
            <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
            <td className="px-4 py-3 text-right">
              {u.id !== user!.id && (
                <button className={u.status === "ACTIVE" ? "btn-ghost px-3 py-1.5 text-error" : "btn-secondary px-3 py-1.5"}
                  onClick={() => { const s = u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"; setUserStatus(u.id, s); toast(`${u.name} ${s === "ACTIVE" ? "reactivated" : "suspended"}`, "info"); }}>
                  {u.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                </button>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
