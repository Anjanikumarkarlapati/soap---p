"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { isClosed, isFull } from "@/lib/data";
import { CellGrid, CourseCard, EmptyState, PageHeader } from "@/components/ui";

type Sort = "title" | "availability" | "deadline" | "fee";

export default function CatalogPage() {
  const { courses, users, ready } = useStore();
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [mode, setMode] = useState("");
  const [avail, setAvail] = useState("");
  const [maxFee, setMaxFee] = useState("");
  const [sort, setSort] = useState<Sort>("deadline");

  const instructor = (id: string) => users.find((u) => u.id === id)?.name ?? "TBA";
  const depts = [...new Set(courses.map((c) => c.department))].sort();

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return courses
      .filter((c) => c.status === "ACTIVE")
      .filter((c) => !term || `${c.code} ${c.title} ${instructor(c.instructorId)}`.toLowerCase().includes(term))
      .filter((c) => !dept || c.department === dept)
      .filter((c) => !mode || c.mode === mode)
      .filter((c) => !maxFee || c.fee <= Number(maxFee))
      .filter((c) => avail === "" || (avail === "open" ? !isClosed(c) && !isFull(c) : avail === "full" ? isFull(c) : isClosed(c)))
      .sort((a, b) =>
        sort === "title" ? a.title.localeCompare(b.title)
        : sort === "fee" ? a.fee - b.fee
        : sort === "availability" ? (b.capacity - b.enrolledCount) - (a.capacity - a.enrolledCount)
        : a.enrollmentDeadline.localeCompare(b.enrollmentDeadline));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, users, q, dept, mode, avail, maxFee, sort]);

  const reset = () => { setQ(""); setDept(""); setMode(""); setAvail(""); setMaxFee(""); };
  const filtered = q || dept || mode || avail || maxFee;

  return (
    <>
      <PageHeader title="Course catalog" subtitle="Fall 2026 · Search by course code, title or instructor" />

      <div className="card mb-6 p-4">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <label htmlFor="q" className="label">Search</label>
            <input id="q" type="search" className="input" placeholder="e.g. CS240 or Distributed" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="dept" className="label">Department</label>
            <select id="dept" className="input" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">All</option>{depts.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="mode" className="label">Mode</label>
            <select id="mode" className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="">All</option><option>In person</option><option>Online</option><option>Hybrid</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="avail" className="label">Availability</label>
            <select id="avail" className="input" value={avail} onChange={(e) => setAvail(e.target.value)}>
              <option value="">All</option><option value="open">Open seats</option><option value="full">Full</option><option value="closed">Deadline passed</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="fee" className="label">Max tuition</label>
            <select id="fee" className="input" value={maxFee} onChange={(e) => setMaxFee(e.target.value)}>
              <option value="">Any</option><option value="1000">≤ $1,000</option><option value="1500">≤ $1,500</option><option value="2000">≤ $2,000</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-sm text-muted" aria-live="polite">{list.length} course{list.length === 1 ? "" : "s"}</p>
          <div className="flex items-center gap-2">
            {filtered && <button className="btn-ghost px-3 py-1.5" onClick={reset}>Clear filters</button>}
            <label htmlFor="sort" className="text-sm text-muted">Sort by</label>
            <select id="sort" className="input w-auto py-1.5" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="deadline">Deadline</option><option value="availability">Seats available</option><option value="title">Course name</option><option value="fee">Tuition</option>
            </select>
          </div>
        </div>
      </div>

      {!ready ? (
        <CellGrid className="sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="space-y-3 p-8"><div className="skeleton aspect-[4/3]" /><div className="skeleton h-4 w-24" /><div className="skeleton h-5 w-3/4" /><div className="skeleton h-11" /></div>)}
        </CellGrid>
      ) : list.length === 0 ? (
        <EmptyState title="No courses match your search" body="Try a different course code or remove some filters." action={<button className="btn-primary" onClick={reset}>Reset filters</button>} />
      ) : (
        <CellGrid className="sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c, i) => <CourseCard key={c.id} index={i} course={c} instructor={instructor(c.instructorId)} href={`/student/courses/${c.id}`} />)}
        </CellGrid>
      )}
    </>
  );
}
