"use client";
import { PageHeader } from "@/components/ui";
import { CourseForm } from "@/components/course-admin";

export default function AdminNewCourse() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New course" subtitle="Assign an instructor and set capacity, tuition and deadline" />
      <CourseForm backHref="/admin/courses" />
    </div>
  );
}
