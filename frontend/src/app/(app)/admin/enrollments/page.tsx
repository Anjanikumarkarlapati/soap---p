"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { PageHeader, Stat, CellGrid } from "@/components/ui";
import { EnrollmentsTable, SearchBar } from "@/components/course-admin";

export default function AdminEnrollments() {
  const { enrollments, users, courses } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const list = enrollments.filter((e) => {
    const text = `${e.id} ${users.find((u) => u.id === e.studentId)?.name} ${courses.find((c) => c.id === e.courseId)?.code}`.toLowerCase();
    return text.includes(q.toLowerCase()) && (!status || e.status === status);
  });
  const count = (s: string) => enrollments.filter((e) => e.status === s).length;
  return (
    <>
      <PageHeader title="Enrollment monitoring" subtitle="All enrollment requests across courses" />
      <CellGrid className="mb-6 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Confirmed" value={count("CONFIRMED")} tone="success" />
        <Stat label="Pending payment" value={count("PENDING")} tone="warning" />
        <Stat label="Failed" value={count("FAILED")} tone="error" />
        <Stat label="Cancelled" value={count("CANCELLED")} tone="info" />
      </CellGrid>
      <SearchBar label="Search by ID, student or course" value={q} onChange={setQ}>
        <div><label htmlFor="status" className="label">Status</label>
          <select id="status" className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option><option>PENDING</option><option>CONFIRMED</option><option>CANCELLED</option><option>FAILED</option></select></div>
      </SearchBar>
      <EnrollmentsTable list={list} />
    </>
  );
}
