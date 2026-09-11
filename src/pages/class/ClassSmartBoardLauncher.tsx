import { useCallback, useEffect, useState } from "react";
import { classRoot } from "@/lib/product/workspaceRoutes";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import NotebookCover, { NotebookCoverData } from "@/components/lessonnotes/NotebookCover";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";

type AttachedNote = NotebookCoverData & { id: string };

const ClassSmartBoardLauncher = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [className, setClassName] = useState("");
  const [visibility, setVisibility] = useState<"teacher_only" | "student_access_enabled">("teacher_only");
  const [notes, setNotes] = useState<AttachedNote[]>([]);

  const load = useCallback(async () => {
    if (!classId) return;
    const { data: cls } = await supabase.from("classes").select("name, smartboard_visibility").eq("id", classId).single();
    if (cls) {
      setClassName(cls.name);
      setVisibility((cls as { smartboard_visibility: typeof visibility }).smartboard_visibility);
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
    setLiveId((live as { notebook_id?: string | null } | null)?.notebook_id ?? null);
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
    const next = visibility === "teacher_only" ? "student_access_enabled" : "teacher_only";
    const { error } = await supabase
      .from("classes")
      .update({ smartboard_visibility: next })
      .eq("id", classId!);
    if (error) {
      toast({ title: "Could not change visibility", description: error.message, variant: "destructive" });
      return;
    }
    await supabase
      .from("class_lesson_notes")
      .update({ visibility: next })
      .eq("class_id", classId!);
    setVisibility(next);
    toast({ title: next === "student_access_enabled" ? "Students can now see the board" : "Board is now teacher only" });
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to={`${classRoot()}/${classId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Class
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">SmartBoard · {className}</h1>
        <button
          onClick={toggleVisibility}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs ${
            visibility === "student_access_enabled"
              ? "border-green-500/40 bg-green-500/10 text-green-300"
              : "border-border text-muted-foreground"
          }`}
        >
          {visibility === "student_access_enabled" ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {visibility === "student_access_enabled" ? "Student Access Enabled" : "Teacher Only"}
        </button>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {notes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            No lesson note selected.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {notes.map((n) => (
              <NotebookCover
                key={n.id}
                notebook={n}
                onClick={() => navigate(`/smartboard/${n.id}?classId=${classId}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ClassSmartBoardLauncher;
