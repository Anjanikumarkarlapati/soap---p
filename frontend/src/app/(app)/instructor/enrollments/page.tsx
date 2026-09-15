"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/ui";
import { EnrollmentsTable } from "@/components/course-admin";

export default function InstructorEnrollments() {
  const { user, courses, enrollments } = useStore();
  const mine = courses.filter((c) => c.instructorId === user!.id);
  const [courseId, setCourseId] = useState("");
  const [status, setStatus] = useState("");
  const list = enrollments.filter((e) => mine.some((c) => c.id === e.courseId) && (!courseId || e.courseId === courseId) && (!status || e.status === status));
  return (
    <>
      <PageHeader title="Enrollments" subtitle="Students enrolled in your courses" />
      <div className="mb-4 flex flex-wrap gap-3">
        <div><label htmlFor="course" className="label">Course</label>
          <select id="course" className="input w-56" value={courseId} onChange={(e) => setCourseId(e.target.value)}><option value="">All my courses</option>{mine.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}</select></div>
        <div><label htmlFor="status" className="label">Status</label>
          <select id="status" className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option><option>PENDING</option><option>CONFIRMED</option><option>CANCELLED</option><option>FAILED</option></select></div>
      </div>
      <EnrollmentsTable list={list} />
    </>
  );
}
