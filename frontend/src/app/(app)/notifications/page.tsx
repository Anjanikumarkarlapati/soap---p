"use client";
import { useStore } from "@/lib/store";
import { fmtDate } from "@/lib/data";
import { EmptyState, PageHeader } from "@/components/ui";

export default function Notifications() {
  const { audit, user } = useStore();
  const list = user!.role === "ADMIN" ? audit : audit.filter((a) => a.actorId === user!.id);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" />
      {list.length === 0 ? <EmptyState title="You’re all caught up" body="Activity on your courses will appear here." /> : (
        <ul className="card divide-y divide-border">
          {list.slice(0, 30).map((a) => (
            <li key={a.id} className="flex justify-between gap-4 p-4 text-sm"><span>{a.action.replaceAll("_", " ").toLowerCase()} · {a.entityId}</span><span className="caption">{fmtDate(a.createdAt)}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}
