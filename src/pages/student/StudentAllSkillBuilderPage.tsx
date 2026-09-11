import { GraduationCap, Lock } from "lucide-react";

import { Link } from "@/lib/router-compat";
import StudentLearningPage from "@/components/student/StudentLearningPage";
import { EmptyNote } from "@/components/workspace/DashboardParts";
import { useMySkillBuilders } from "@/lib/student/useLearning";

/**
 * Every Courses pathway from every class the student belongs to. A locked
 * step stays locked: the teacher's sequential rules decide what opens.
 */
const StudentAllSkillBuilderPage = () => {
  const { data, isLoading } = useMySkillBuilders();
  const rows = data ?? [];
  const classNames = Array.from(new Set(rows.map((r) => r.className)));

  return (
    <StudentLearningPage
      title="Courses"
      subtitle="Every class you belong to"
      blurb="Practice pathways your teachers prepared for you."
      loading={isLoading}
      empty="No Courses activities yet."
    >
      {rows.length === 0 ? (
        <EmptyNote>No Courses activities yet. They appear here once a teacher adds one to your class.</EmptyNote>
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
                  .map((row) => {
                    const card = (
                      <div
                        className={`grid min-h-[64px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-4 ${
                          row.unlocked ? "border-border/60 bg-card/60" : "border-dashed border-border/60 bg-muted/20"
                        }`}
                      >
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                          {row.unlocked ? <GraduationCap className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{row.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {row.unlocked
                              ? row.status === "completed"
                                ? "Completed"
                                : row.status === "in_progress"
                                  ? "In progress"
                                  : "Ready to start"
                              : `Complete ${row.blockedBy || "the previous course"} first`}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {row.unlocked ? "Open" : "Locked"}
                        </span>
                      </div>
                    );
                    return (
                      <li key={`${row.classId}:${row.courseId}`}>
                        {row.unlocked ? (
                          <Link to={`/student/class/${row.classId}/courses/${row.courseId}`} className="block">
                            {card}
                          </Link>
                        ) : (
                          <div aria-disabled className="cursor-not-allowed">{card}</div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </StudentLearningPage>
  );
};

export default StudentAllSkillBuilderPage;
