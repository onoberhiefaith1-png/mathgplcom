// Teacher — the Exercise Cards of one assigned course.
//
// Entry point for "View" (test the questions on the existing Test Smartboard)
// and for attaching the interactive teaching video to each question.

import { useEffect, useState } from "react";
import { Link, useParams } from "@/lib/router-compat";
import { ArrowLeft, ClipboardList, Loader2 } from "lucide-react";
import { loadCourseTree } from "@/lib/courses/api";
import type { CourseTree } from "@/lib/courses/types";

const TeacherExerciseCardsPage = () => {
  const { classId, courseId } = useParams<{ classId: string; courseId: string }>();
  const [tree, setTree] = useState<CourseTree | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) return;
    void loadCourseTree(courseId)
      .then(setTree)
      .finally(() => setLoading(false));
  }, [courseId]);

  const cards = (tree?.blocks ?? [])
    .filter((b) => b.kind === "exercise")
    .map((block) => ({ block, section: (tree?.sections ?? []).find((s) => s.id === block.section_id) }));


  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-6 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          to={`/teaching-hub/classes/${classId}/courses`}
          className="inline-flex min-h-[44px] items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to class courses
        </Link>

        <h1 className="mt-3 text-lg font-semibold">
          {tree?.course.title || "Course"} — Exercise Cards
        </h1>

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading course…
          </div>
        ) : cards.length === 0 ? (
          <p className="mt-8 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            This course has no Exercise Cards yet.
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {cards.map(({ section, block }) => {
              const config = (block.config ?? {}) as { name?: string; questionIds?: string[] };
              const count = (tree?.questions ?? []).filter((q) => q.block_id === block.id).length;
              return (
                <li key={block.id}>
                  <Link
                    to={`/teaching-hub/classes/${classId}/courses/${courseId}/exercise/${block.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary/50"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {config.name || "Exercise"}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {section?.title || "Section"} · {count} question{count === 1 ? "" : "s"}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">View</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TeacherExerciseCardsPage;
