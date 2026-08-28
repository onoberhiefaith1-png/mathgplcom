import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowDown, ArrowUp, GraduationCap, Loader2, MonitorPlay, Pencil, Plus, Trash2, GripVertical } from "lucide-react";
import ClassPageShell from "@/components/class/ClassPageShell";
import AssignCourseDialog from "@/components/coursebuilder/AssignCourseDialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { classRoot, productTerms } from "@/lib/product/workspaceRoutes";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";
import {
  assignCourseToClass,
  getClassCourseSettings,
  listClassCourses,
  removeClassCourse,
  reorderClassCourses,
  setClassCourseSettings,
  type ClassCourse,
  type LearningMode,
} from "@/lib/courses/classCourses";
import { syncCourseExerciseAssessments } from "@/lib/courses/exerciseBoard";

/** The class curriculum planner: assign, order and sequence existing courses. */
const ClassCoursesPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [className, setClassName] = useState("");
  const [pathway, setPathway] = useState<ClassCourse[]>([]);
  const [mode, setMode] = useState<LearningMode>("free");
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [loadError, setLoadError] = useState("");

  const refresh = useCallback(async () => {
    if (!classId) return;
    const [rows, settings] = await Promise.all([
      listClassCourses(classId),
      getClassCourseSettings(classId),
    ]);
    setPathway(rows);
    setMode(settings.learning_mode);
    // Prepare/refresh the hidden solving board behind every Exercise Card so
    // students can open "View Questions" straight away.
    void syncCourseExerciseAssessments(classId).catch(() => {});
  }, [classId]);

  useEffect(() => {
    (async () => {
      if (!classId) return;
      try {
        setLoading(true);
        setLoadError("");
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          navigate(`/login?next=${encodeURIComponent(`${classRoot()}/${classId}/courses`)}`);
          return;
        }
        const redirect = await ensureClassOwner(classId, userData.user.id);
        if (redirect) {
          navigate(redirect, { replace: true });
          return;
        }
        const { data } = await supabase.from("classes").select("name").eq("id", classId).maybeSingle();
        setClassName(data?.name ?? "Class");
        await refresh();
      } catch (e: unknown) {
        const message = String((e as Error)?.message ?? e);
        setLoadError(message);
        toast({ title: "Could not load courses", description: message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [classId, navigate, refresh]);

  const commit = async (next: ClassCourse[]) => {
    setPathway(next);
    try {
      await reorderClassCourses(next);
    } catch (e: unknown) {
      toast({ title: "Reorder failed", description: String((e as Error)?.message ?? e), variant: "destructive" });
      await refresh();
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= pathway.length || from === to) return;
    const next = [...pathway];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    void commit(next);
  };

  const onAssign = async (courseId: string) => {
    if (!classId) return;
    try {
      await assignCourseToClass(classId, courseId);
      await refresh();
      toast({ title: "Course assigned to this class" });
    } catch (e: unknown) {
      toast({ title: "Assign failed", description: String((e as Error)?.message ?? e), variant: "destructive" });
    }
  };

  const onRemove = async (row: ClassCourse) => {
    if (!window.confirm(`Remove "${row.course.title}" from this class? The course itself is not deleted.`)) return;
    try {
      await removeClassCourse(row.assignmentId);
      const next = pathway.filter((p) => p.assignmentId !== row.assignmentId);
      await commit(next);
    } catch (e: unknown) {
      toast({ title: "Remove failed", description: String((e as Error)?.message ?? e), variant: "destructive" });
    }
  };

  const changeMode = async (next: LearningMode) => {
    if (!classId) return;
    setMode(next);
    try {
      await setClassCourseSettings(classId, { learning_mode: next });
    } catch (e: unknown) {
      toast({ title: "Could not save learning mode", description: String((e as Error)?.message ?? e), variant: "destructive" });
    }
  };

  return (
    <ClassPageShell
      backTo={`${classRoot()}/${classId}`}
      backLabel={`${productTerms().space} dashboard`}
      title="Courses"
      subtitle={`The learning pathway for ${className || "this class"}. Courses are created in Skill Builder — here you decide which ones this class studies, in what order.`}
      actions={
        <Button onClick={() => setPicker(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Assign Course
        </Button>
      }
    >
      <section className="mb-6 rounded-2xl border border-dash-border bg-dash-surface p-5 shadow-[var(--shadow-dash)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-surface-muted">
          Learning Mode
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {([
            { id: "sequential" as const, label: "Sequential", blurb: "Each course unlocks when the previous one is completed." },
            { id: "free" as const, label: "Free", blurb: "Every assigned course is open straight away." },
          ]).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => changeMode(opt.id)}
              className={`min-h-[44px] flex-1 min-w-[15rem] rounded-xl border px-4 py-3 text-left transition ${
                mode === opt.id
                  ? "border-dash-gold bg-dash-navy/5 text-dash-surface-foreground"
                  : "border-dash-border text-dash-surface-muted hover:border-dash-gold"
              }`}
            >
              <div className="text-sm font-semibold text-dash-surface-foreground">{opt.label}</div>
              <div className="text-xs text-dash-surface-muted">{opt.blurb}</div>
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-dash-surface/70">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading pathway…
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-dash-border bg-dash-surface p-8 text-center shadow-[var(--shadow-dash)]">
          <p className="text-sm text-dash-surface-muted">The course pathway could not be loaded.</p>
          <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>Try again</Button>
        </div>
      ) : pathway.length === 0 ? (
        <div className="rounded-2xl border border-dash-border bg-dash-surface p-10 text-center shadow-[var(--shadow-dash)]">
          <GraduationCap className="mx-auto h-8 w-8 text-dash-surface-muted" />
          <div className="mt-3 text-lg font-semibold text-dash-surface-foreground">
            No courses have been assigned.
          </div>
          <p className="mt-1 text-xs text-dash-surface-muted">
            Assign a course you already built in Skill Builder to start this class's pathway.
          </p>
          <Button className="mt-5" onClick={() => setPicker(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Assign Course
          </Button>
        </div>
      ) : (
        <ol className="space-y-3">
          {pathway.map((row, i) => (
            <li
              key={row.assignmentId}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIdx !== null) move(dragIdx, i);
                setDragIdx(null);
              }}
              onDragEnd={() => setDragIdx(null)}
              className={`flex items-center gap-3 rounded-2xl border border-dash-border bg-dash-surface p-4 shadow-[var(--shadow-dash)] transition ${
                dragIdx === i ? "opacity-60" : ""
              }`}
            >
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-dash-surface-muted" aria-hidden />
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-sm font-semibold text-dash-surface">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold text-dash-surface-foreground">
                  {row.course.title || "Untitled course"}
                </div>
                <div className="truncate text-xs text-dash-surface-muted">
                  {[row.course.subject, row.course.topic, row.course.subtopic].filter(Boolean).join(" · ") ||
                    "No topic set"}
                  {" · "}
                  {row.course.status === "published" ? "Published" : "Draft — visible to this class"}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  className="grid h-11 w-11 place-items-center rounded-lg border border-dash-border text-dash-surface-muted transition hover:border-dash-gold disabled:opacity-40"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  onClick={() => move(i, i + 1)}
                  disabled={i === pathway.length - 1}
                  className="grid h-11 w-11 place-items-center rounded-lg border border-dash-border text-dash-surface-muted transition hover:border-dash-gold disabled:opacity-40"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <Link
                  to={`/teaching-hub/classes/${classId}/courses/${row.course.id}/exercises`}
                  aria-label="Exercise Cards and teaching videos"
                  title="Exercise Cards"
                  className="grid h-11 w-11 place-items-center rounded-lg border border-dash-border text-dash-surface-muted transition hover:border-dash-gold"
                >
                  <MonitorPlay className="h-4 w-4" />
                </Link>
                <Link
                  to={`/course-builder/${row.course.id}`}
                  aria-label="Edit in Skill Builder"
                  className="grid h-11 w-11 place-items-center rounded-lg border border-dash-border text-dash-surface-muted transition hover:border-dash-gold"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  aria-label="Remove from class"
                  onClick={() => onRemove(row)}
                  className="grid h-11 w-11 place-items-center rounded-lg border border-dash-border text-dash-surface-muted transition hover:border-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <AssignCourseDialog
        open={picker}
        onOpenChange={setPicker}
        assignedIds={pathway.map((p) => p.course.id)}
        onAssign={onAssign}
      />
    </ClassPageShell>
  );
};

export default ClassCoursesPage;
