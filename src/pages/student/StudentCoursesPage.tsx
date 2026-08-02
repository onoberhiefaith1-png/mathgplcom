import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Check, GraduationCap, Loader2, Lock, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getClassCourseSettings,
  listClassCourses,
  myCourseProgress,
  unlockedFlags,
  type ClassCourse,
  type CourseProgressRow,
  type LearningMode,
} from "@/lib/courses/classCourses";
import { Link } from "@/lib/router-compat";

/** Students only ever see the pathway their teacher prepared. */
const StudentCoursesPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [pathway, setPathway] = useState<ClassCourse[]>([]);
  const [progress, setProgress] = useState<CourseProgressRow[]>([]);
  const [mode, setMode] = useState<LearningMode>("free");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!classId) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      navigate(`/auth?redirect=/student/class/${classId}/courses`);
      return;
    }
    const [rows, settings, prog] = await Promise.all([
      listClassCourses(classId),
      getClassCourseSettings(classId),
      myCourseProgress(classId),
    ]);
    setPathway(rows);
    setMode(settings.learning_mode);
    setProgress(prog);
    setLoading(false);
  }, [classId, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const unlocked = unlockedFlags(pathway, progress, mode);
  const statusOf = (courseId: string) =>
    progress.find((p) => p.course_id === courseId)?.status ?? "not_started";

  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-6 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          to={`/student/class/${classId}`}
          className="inline-flex min-h-[44px] items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Class
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">My Courses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "sequential"
            ? "Complete each course to unlock the next one."
            : "Study these courses in any order."}
        </p>

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your courses…
          </div>
        ) : pathway.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center">
            <GraduationCap className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Your teacher has not added any courses yet.
            </p>
          </div>
        ) : (
          <ol className="mt-6 space-y-3">
            {pathway.map((row, i) => {
              const status = statusOf(row.course.id);
              const open = unlocked[i];
              const previous = pathway[i - 1]?.course.title;
              const card = (
                <div
                  className={`flex items-center gap-3 rounded-2xl border p-4 ${
                    open ? "border-border bg-card" : "border-dashed border-border bg-muted/40"
                  }`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                    {status === "completed" ? (
                      <Check className="h-5 w-5 text-emerald-600" />
                    ) : open ? (
                      <Play className="h-5 w-5" />
                    ) : (
                      <Lock className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold text-foreground">
                      {row.course.title || "Untitled course"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {status === "completed"
                        ? "Completed"
                        : open
                          ? status === "in_progress"
                            ? "In progress"
                            : "Ready to start"
                          : `Complete ${previous || "the previous course"} first`}
                    </div>
                  </div>
                </div>
              );
              return (
                <li key={row.assignmentId}>
                  {open ? (
                    <Link to={`/student/class/${classId}/courses/${row.course.id}`} className="block">
                      {card}
                    </Link>
                  ) : (
                    <div aria-disabled className="cursor-not-allowed">
                      {card}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
};

export default StudentCoursesPage;
