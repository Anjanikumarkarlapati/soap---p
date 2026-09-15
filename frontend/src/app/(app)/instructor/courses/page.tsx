"use client";
import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/ui";
import { CoursesTable, SearchBar } from "@/components/course-admin";

export default function InstructorCourses() {
  const { user, courses } = useStore();
  const [q, setQ] = useState("");
  const list = courses.filter((c) => c.instructorId === user!.id && `${c.code} ${c.title}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="My courses" subtitle="Courses you teach this semester" actions={<Link href="/instructor/courses/new" className="btn-primary">+ Create course</Link>} />
      <SearchBar label="Search my courses" value={q} onChange={setQ} />
      <CoursesTable list={list} editBase="/instructor/courses" />
    </>
  );
}
