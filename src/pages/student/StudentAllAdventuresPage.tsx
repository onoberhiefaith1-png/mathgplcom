import { Compass } from "lucide-react";

import { Link } from "@/lib/router-compat";
import StudentLearningPage from "@/components/student/StudentLearningPage";
import { EmptyNote } from "@/components/workspace/DashboardParts";
import { useMyAdventures } from "@/lib/student/useLearning";

/**
 * Every Adventure from every class the student belongs to. Selecting one opens
 * the Adventure the teacher created, ready to play — never an editor.
 */
const StudentAllAdventuresPage = () => {
  const { data, isLoading } = useMyAdventures();
  const rows = data ?? [];
  const classNames = Array.from(new Set(rows.map((r) => r.className)));

  return (
    <StudentLearningPage
      title="Adventure"
      subtitle="Every class you belong to"
      blurb="Adventures your teachers prepared. Pick one to play it."
      loading={isLoading}
      empty="No adventures yet."
    >
      {rows.length === 0 ? (
        <EmptyNote>No Adventures yet. They appear here once a teacher shares one with your class.</EmptyNote>
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
                    <li key={row.id}>
                      <Link
                        to={`/student/class/${row.classId}/assignment/${row.notebookId}`}
                        className="grid min-h-[64px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 transition hover:border-primary/40"
                      >
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                          <Compass className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{row.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {row.detail ?? row.className}
                            {row.dueAt ? ` · due ${new Date(row.dueAt).toLocaleDateString()}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          Play
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

export default StudentAllAdventuresPage;
