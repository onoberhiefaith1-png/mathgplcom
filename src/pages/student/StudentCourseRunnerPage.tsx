import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import StudentView from "@/components/coursebuilder/StudentView";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { loadCourseTree } from "@/lib/courses/api";
import type { CourseTree } from "@/lib/courses/types";
import {
  getClassCourseSettings,
  listClassCourses,
  markCourseProgress,
  myCourseProgress,
  unlockedFlags,
} from "@/lib/courses/classCourses";

/** A student running one course from their class pathway. Locked courses are
 *  refused here too, not just hidden on the list. */
const StudentCourseRunnerPage = () => {
  const { classId, courseId } = useParams<{ classId: string; courseId: string }>();
  const navigate = useNavigate();
  const [tree, setTree] = useState<CourseTree | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    (async () => {
      if (!classId || !courseId) return;
      try {
        setLoading(true);
        setLoadError("");
        const [pathway, settings, progress] = await Promise.all([
          listClassCourses(classId), getClassCourseSettings(classId), myCourseProgress(classId),
        ]);
        const idx = pathway.findIndex((p) => p.course.id === courseId);
        if (idx < 0) {
          navigate(`/student/class/${classId}/courses`, { replace: true });
          return;
        }
        if (!unlockedFlags(pathway, progress, settings.learning_mode)[idx]) {
          toast({ title: "This course is still locked" });
          navigate(`/student/class/${classId}/courses`, { replace: true });
          return;
        }
        setDone(progress.find((p) => p.course_id === courseId)?.status === "completed");
        setTree(await loadCourseTree(courseId));
        await markCourseProgress({ classId, courseId, status: "in_progress", progress: 10 });
      } catch (e: unknown) {
        const message = String((e as Error)?.message ?? e);
        setLoadError(message);
        toast({ title: "Could not open course", description: message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [classId, courseId, navigate]);

  const complete = async () => {
    if (!classId || !courseId) return;
    setSaving(true);
    try {
      await markCourseProgress({ classId, courseId, status: "completed", progress: 100 });
      setDone(true);
      toast({ title: "Course completed" });
    } catch (e: unknown) {
      toast({ title: "Could not save", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            to={`/student/class/${classId}/courses`}
            className="inline-flex min-h-[40px] items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> My Courses
          </Link>
          <div className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-foreground">
            {tree?.course.title || (loading ? "" : "Course")}
          </div>
          {done ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-600">
              <Check className="h-3.5 w-3.5" /> Completed
            </span>
          ) : (
            <span className="w-[92px] shrink-0" />
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
        {loading ? (
          <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading course…
          </div>
        ) : loadError || !tree ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">This course could not be opened.</p>
            <Button className="mt-4" variant="outline" onClick={() => navigate(`/student/class/${classId}/courses`)}>Back to courses</Button>
          </div>
        ) : (
          <>
            <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
              <StudentView
                tree={tree}
                onOpenExercise={(blockId) =>
                  navigate(`/student/class/${classId}/courses/${courseId}/exercise/${blockId}`)
                }
              />

            </div>
            <div className="mt-6 flex justify-end">
              {done ? (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-600">
                  <Check className="h-4 w-4" /> Completed
                </span>
              ) : (
                <Button onClick={complete} disabled={saving} className="min-h-[44px]">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Mark course complete
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

};

export default StudentCourseRunnerPage;
