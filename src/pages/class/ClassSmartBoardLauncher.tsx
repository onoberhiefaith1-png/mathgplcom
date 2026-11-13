import { useCallback, useEffect, useState } from "react";
import { classRoot } from "@/lib/product/workspaceRoutes";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Eye, EyeOff, Library } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import NotebookCover, {
  NotebookCoverData,
} from "@/components/lessonnotes/NotebookCover";
import { ClassroomAcademiaHost } from "@/components/smartboard/ClassroomAcademiaStage";
import { ClassroomSurfaceSwitch } from "@/components/smartboard/ClassroomSurfaceSwitch";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";

type AttachedNote = NotebookCoverData & { id: string };

const ClassSmartBoardLauncher = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [className, setClassName] = useState("");
  const [visibility, setVisibility] = useState<
    "teacher_only" | "student_access_enabled"
  >("teacher_only");
  const [notes, setNotes] = useState<AttachedNote[]>([]);
  const [liveId, setLiveId] = useState<string | null>(null);
  const [academiaOpen, setAcademiaOpen] = useState(false);

  const load = useCallback(async () => {
    if (!classId) return;
    const { data: cls } = await supabase
      .from("classes")
      .select("name, smartboard_visibility")
      .eq("id", classId)
      .single();
    if (cls) {
      setClassName(cls.name);
      setVisibility(
        (cls as { smartboard_visibility: typeof visibility })
          .smartboard_visibility,
      );
    }
    const { data: links } = await supabase
      .from("class_lesson_notes")
      .select("notebook_id")
      .eq("class_id", classId);
    const ids = (links ?? []).map((l) => l.notebook_id);
    if (ids.length === 0) {
      setNotes([]);
      return;
    }
    const { data: nbs } = await supabase
      .from("notebooks")
      .select("id, title, teacher, class_name, session, subject, color_index")
      .in("id", ids);
    setNotes((nbs ?? []) as AttachedNote[]);
    // Which note the class is watching right now.
    const { data: live } = await supabase
      .from("class_smartboard_state")
      .select("notebook_id")
      .eq("class_id", classId)
      .maybeSingle();
    setLiveId(
      (live as { notebook_id?: string | null } | null)?.notebook_id ?? null,
    );
  }, [classId]);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=${classRoot()}/${classId}/smartboard`);
        return;
      }
      const redirect = await ensureClassOwner(classId!, userData.user.id);
      if (redirect) {
        navigate(redirect, { replace: true });
        return;
      }
      await load();
    })();
  }, [classId, navigate, load]);

  const toggleVisibility = async () => {
    const next =
      visibility === "teacher_only" ? "student_access_enabled" : "teacher_only";
    const { error } = await supabase
      .from("classes")
      .update({ smartboard_visibility: next })
      .eq("id", classId!);
    if (error) {
      toast({
        title: "Could not change visibility",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    await supabase
      .from("class_lesson_notes")
      .update({ visibility: next })
      .eq("class_id", classId!);
    setVisibility(next);
    toast({
      title:
        next === "student_access_enabled"
          ? "Students can now see the board"
          : "Board is now teacher only",
    });
  };

  const openAcademia = () => {
    const target = liveId ?? notes[0]?.id ?? null;
    if (target) {
      navigate(`/smartboard/${target}?classId=${classId}&surface=academia`);
      return;
    }
    setAcademiaOpen(true);
  };

  if (academiaOpen && classId) {
    return (
      <div className="flex h-screen min-h-screen w-full flex-col bg-background text-foreground">
        <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
          <ClassroomSurfaceSwitch
            value="academia"
            onChange={(next) => {
              if (next !== "academia") setAcademiaOpen(false);
            }}
          />
          <button
            type="button"
            onClick={() => setAcademiaOpen(false)}
            className="ml-auto rounded-md border border-border px-3 py-1.5 text-xs font-medium"
          >
            Close
          </button>
        </header>
        <ClassroomAcademiaHost classId={classId} role="teacher" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link
          to={`${classRoot()}/${classId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Class
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">
          SmartBoard · {className}
        </h1>
        <button
          onClick={toggleVisibility}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs ${
            visibility === "student_access_enabled"
              ? "border-green-500/40 bg-green-500/10 text-green-300"
              : "border-border text-muted-foreground"
          }`}
        >
          {visibility === "student_access_enabled" ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
          {visibility === "student_access_enabled"
            ? "Student Access Enabled"
            : "Teacher Only"}
        </button>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col-reverse gap-6 px-6 py-8 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1" data-testid="smartboard-lesson-notes">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Lesson Notes
          </h2>
          {notes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              No lesson note selected.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {notes.map((n) => (
                <div key={n.id} className="relative">
                  {liveId === n.id && (
                    <span className="absolute -top-2 left-2 z-10 rounded-full border border-green-500/40 bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-300">
                      Live now
                    </span>
                  )}
                  <NotebookCover
                    notebook={n}
                    onClick={() =>
                      navigate(`/smartboard/${n.id}?classId=${classId}`)
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-80">
          <button
            type="button"
            onClick={openAcademia}
            data-testid="smartboard-academia-option"
            className="flex w-full flex-col items-start gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-6 text-left shadow-sm transition hover:border-primary"
          >
            <Library className="h-8 w-8 text-primary" />
            <span className="text-lg font-semibold">Academia</span>
            <span className="text-sm text-muted-foreground">
              Open the Academias connected to your workspace. The class follows
              what you open, including the question you are solving.
            </span>
          </button>
        </aside>
      </main>
    </div>
  );
};

export default ClassSmartBoardLauncher;
