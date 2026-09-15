"use client";
import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/ui";
import { CoursesTable, SearchBar } from "@/components/course-admin";

export default function AdminCourses() {
  const { courses } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const list = courses.filter((c) => `${c.code} ${c.title} ${c.department}`.toLowerCase().includes(q.toLowerCase()) && (!status || c.status === status));
  return (
    <>
      <PageHeader title="Courses" subtitle="Manage catalog, capacity and deadlines" actions={<Link href="/admin/courses/new" className="btn-primary">+ New course</Link>} />
      <SearchBar label="Search courses" value={q} onChange={setQ}>
        <div><label htmlFor="status" className="label">Status</label>
          <select id="status" className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option><option>ACTIVE</option><option>DRAFT</option><option>ARCHIVED</option></select></div>
      </SearchBar>
      <CoursesTable list={list} editBase="/admin/courses" />
    </>
  );
}
