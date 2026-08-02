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

  useEffect(() => {
    (async () => {
      if (!classId || !courseId) return;
      const [pathway, settings, progress] = await Promise.all([
        listClassCourses(classId),
        getClassCourseSettings(classId),
        myCourseProgress(classId),
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
      try {
        setTree(await loadCourseTree(courseId));
        await markCourseProgress({ classId, courseId, status: "in_progress", progress: 10 });
      } catch (e: unknown) {
        toast({ title: "Could not open course", description: String((e as Error)?.message ?? e), variant: "destructive" });
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
    <div className="min-h-screen bg-background px-4 pb-28 pt-6 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          to={`/student/class/${classId}/courses`}
          className="inline-flex min-h-[44px] items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> My Courses
        </Link>

        {loading || !tree ? (
          <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading course…
          </div>
        ) : (
          <>
            <div className="mt-4">
              <StudentView tree={tree} />
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
