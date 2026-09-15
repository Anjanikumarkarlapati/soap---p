"use client";
import { PageHeader } from "@/components/ui";
import { CourseForm } from "@/components/course-admin";

export default function NewCourse() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Create course" subtitle="New courses open for enrollment when set to Active" />
      <CourseForm backHref="/instructor/courses" />
    </div>
  );
}
