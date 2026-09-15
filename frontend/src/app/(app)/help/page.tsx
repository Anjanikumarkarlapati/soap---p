import { PageHeader } from "@/components/ui";

const FAQ = [
  ["Why is the Enroll button disabled?", "The course is either full (all seats taken) or the enrollment deadline has passed. The reason is shown under the button."],
  ["Is my seat guaranteed after I enroll?", "Your seat is reserved immediately with status PENDING. Pay tuition to move it to CONFIRMED. If payment fails, the seat is released."],
  ["I clicked Confirm twice — will I be enrolled twice?", "No. Each confirmation carries a unique request key and you can hold only one active enrollment per course."],
  ["My payment is taking a long time.", "Don’t pay again. If the status doesn’t update within a few minutes, contact support with your enrollment ID."],
  ["How do I cancel?", "Open My Enrollments and choose Cancel on a pending enrollment. Confirmed enrollments are handled by the registrar."],
];

export default function Help() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Help & support" subtitle="Answers to common registration questions" />
      <div className="card divide-y divide-border">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {q}<span aria-hidden className="text-muted transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 text-sm text-muted">{a}</p>
          </details>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted">Still stuck? Email <a className="text-primary hover:underline" href="mailto:registrar@academiax.edu">registrar@academiax.edu</a>.</p>
    </div>
  );
}
