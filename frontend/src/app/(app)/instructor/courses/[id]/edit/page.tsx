"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { EmptyState, PageHeader } from "@/components/ui";
import { CourseForm } from "@/components/course-admin";

export default function EditCourse() {
  const { id } = useParams<{ id: string }>();
  const { courses, user } = useStore();
  const course = courses.find((c) => c.id === id);
  // Ownership check: instructors may edit only their assigned courses.
  if (!course || course.instructorId !== user!.id) {
    return <EmptyState title="Course not available" body="This course doesn’t exist or isn’t assigned to you." action={<Link href="/instructor/courses" className="btn-primary">Back to my courses</Link>} />;
  }
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${course.code}`} subtitle={course.title} />
      <CourseForm course={course} backHref="/instructor/courses" />
    </div>
  );
}
