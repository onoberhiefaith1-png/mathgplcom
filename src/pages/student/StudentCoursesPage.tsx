import { useCallback, useEffect, useState } from "react";
import { useParams } from "@/lib/router-compat";
import { ArrowLeft, Check, GraduationCap, Loader2, Lock, Play } from "lucide-react";
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
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth/AuthProvider";

/** Students only ever see the pathway their teacher prepared. */
const StudentCoursesPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const { user } = useAuth();
  const [pathway, setPathway] = useState<ClassCourse[]>([]);
  const [progress, setProgress] = useState<CourseProgressRow[]>([]);
  const [mode, setMode] = useState<LearningMode>("free");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setLoadError("");
    try {
      if (!user) throw new Error("Your session is not available. Please log in again.");
      const [rows, settings, prog] = await Promise.all([
        listClassCourses(classId), getClassCourseSettings(classId), myCourseProgress(classId),
      ]);
      setPathway(rows);
      setMode(settings.learning_mode);
      setProgress(prog);
    } catch (error) {
      const message = String((error as Error)?.message ?? error);
      setLoadError(message);
      toast({ title: "Could not load your courses", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [classId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const unlocked = unlockedFlags(pathway, progress, mode);
  const statusOf = (courseId: string) =>
    progress.find((p) => p.course_id === courseId)?.status ?? "not_started";

  const unlockedCount = pathway.filter((row, i) => row.available && unlocked[i]).length;
  const completedCount = pathway.filter((row) => statusOf(row.course.id) === "completed").length;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Course header — the same confident presentation the teacher sees. */}
      <div className="border-b border-border/60 bg-gradient-to-br from-primary/12 via-primary/5 to-transparent">
        <div className="mx-auto w-full max-w-3xl px-4 pb-7 pt-6 sm:px-6">
          <Link
            to={`/student/class/${classId}`}
            className="inline-flex min-h-[40px] items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Class
          </Link>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">My Courses</h1>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {mode === "sequential"
                  ? "Complete each course to unlock the next one."
                  : "Study these courses in any order."}
              </p>
            </div>
            {!loading && pathway.length > 0 && (
              <div className="flex gap-2">
                <div className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-center backdrop-blur">
                  <div className="text-lg font-semibold tabular-nums text-foreground">{completedCount}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Completed</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-center backdrop-blur">
                  <div className="text-lg font-semibold tabular-nums text-foreground">{unlockedCount}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Open now</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        {loading ? (
          <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your courses…
          </div>
        ) : loadError ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">Your courses could not be loaded.</p>
            <div className="mt-4 flex justify-center gap-2">
              <button className="min-h-[44px] rounded-lg border border-border px-4 text-sm text-foreground transition hover:bg-muted" onClick={() => void load()}>Retry</button>
              <Link to={`/student/class/${classId}`} className="inline-flex min-h-[44px] items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Back to class</Link>
            </div>
          </div>
        ) : pathway.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
            <GraduationCap className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Your teacher has not added any courses yet.
            </p>
          </div>
        ) : (
          <ol className="mt-6 space-y-3">
            {pathway.map((row, i) => {
              const status = statusOf(row.course.id);
              const open = row.available && unlocked[i];
              const previous = pathway[i - 1]?.course.title;
              const card = (
                <div
                  className={`group flex items-center gap-4 rounded-2xl border p-4 transition ${
                    open
                      ? "border-border bg-card shadow-sm hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                      : "border-dashed border-border bg-muted/40"
                  }`}
                >
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                      status === "completed"
                        ? "bg-emerald-500/15 text-emerald-600"
                        : open
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {status === "completed" ? (
                      <Check className="h-5 w-5" />
                    ) : open ? (
                      <Play className="h-5 w-5" />
                    ) : (
                      <Lock className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Step {i + 1}
                      </span>
                      {status === "in_progress" && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          In progress
                        </span>
                      )}
                    </div>
                    <div className="truncate text-base font-semibold text-foreground">
                      {row.available ? row.course.title || "Untitled course" : `Course ${i + 1}`}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {!row.available
                        ? "This course isn't available yet — ask your teacher"
                        : status === "completed"
                          ? "Completed"
                          : open
                            ? status === "in_progress"
                              ? "Continue where you stopped"
                              : "Ready to start"
                            : `Complete ${previous || "the previous course"} first`}
                    </div>
                  </div>
                  {open && (
                    <span className="hidden shrink-0 text-xs font-semibold text-primary sm:inline">
                      {status === "not_started" ? "Start" : "Open"} →
                    </span>
                  )}
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
