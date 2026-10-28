/**
 * Opening a course from an Academy shelf.
 *
 * The course is the canonical row — this page reads it with the existing course
 * loader and renders it with the existing StudentView, so there is no second
 * copy of the content and no second renderer.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "@/lib/router-compat";
import { ArrowLeft, Loader2 } from "lucide-react";
import StudentView from "@/components/coursebuilder/StudentView";
import { loadCourseTree } from "@/lib/courses/api";
import type { CourseTree } from "@/lib/courses/types";

const AcademyCoursePage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [tree, setTree] = useState<CourseTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const loaded = await loadCourseTree(courseId);
        if (!cancelled) setTree(loaded);
      } catch (e: unknown) {
        if (!cancelled) setError(String((e as Error)?.message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/academy"
            className="inline-flex min-h-[40px] items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Academy
          </Link>
          <span className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-foreground">
            {tree?.course.title || (loading ? "" : "Course")}
          </span>
          <span className="w-[92px]" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
        {loading ? (
          <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading course…
          </div>
        ) : error || !tree ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">This course could not be opened.</p>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <StudentView tree={tree} />
          </div>
        )}
      </div>
    </div>
  );
};

export default AcademyCoursePage;
