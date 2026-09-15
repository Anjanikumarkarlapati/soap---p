"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { EmptyState, PageHeader } from "@/components/ui";
import { CourseForm } from "@/components/course-admin";

export default function AdminEditCourse() {
  const { id } = useParams<{ id: string }>();
  const course = useStore().courses.find((c) => c.id === id);
  if (!course) return <EmptyState title="Course not found" body="It may have been removed." action={<Link href="/admin/courses" className="btn-primary">Back to courses</Link>} />;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${course.code}`} subtitle={course.title} />
      <CourseForm course={course} backHref="/admin/courses" />
    </div>
  );
}
