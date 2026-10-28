import { ClipboardList } from "lucide-react";

import { Link } from "@/lib/router-compat";
import StudentLearningPage from "@/components/student/StudentLearningPage";
import { EmptyNote } from "@/components/workspace/DashboardParts";
import { useMyAssignments } from "@/lib/student/useLearning";

/**
 * Every assignment from every class the student belongs to, grouped by class so
 * it is always clear which class the work came from.
 */
const StudentAllAssignmentsPage = () => {
  const { data, isLoading } = useMyAssignments();
  const rows = data ?? [];
  const classNames = Array.from(new Set(rows.map((r) => r.className)));

  return (
    <StudentLearningPage
      title="Assignments"
      subtitle="Every class you belong to"
      blurb="Work your teachers have given you, across all of your classes."
      loading={isLoading}
      empty="No assignments yet."
    >
      {rows.length === 0 ? (
        <EmptyNote>No assignments yet. They appear here as soon as a teacher gives you work.</EmptyNote>
      ) : (
        <div className="space-y-6">
          {classNames.map((className) => (
            <section key={className}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {className}
              </h2>
              <ul className="space-y-2">
                {rows
                  .filter((r) => r.className === className)
                  .map((row) => (
                    <li key={`${row.classId}:${row.notebookId}`}>
                      <Link
                        to={`/student/class/${row.classId}/assignment/${row.notebookId}`}
                        className="grid min-h-[64px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 transition hover:border-primary/40"
                      >
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                          <ClipboardList className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{row.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {row.subtopic ?? row.className}
                            {row.dueAt ? ` · due ${new Date(row.dueAt).toLocaleDateString()}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {row.completed ? "Done" : "Open"}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </StudentLearningPage>
  );
};

export default StudentAllAssignmentsPage;
