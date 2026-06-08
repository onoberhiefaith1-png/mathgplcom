import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, EyeOff, Eye, Trash2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import NotebookCover, { NotebookCoverData } from "@/components/lessonnotes/NotebookCover";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";

type Notebook = NotebookCoverData & { id: string; subtopic: string };
type Attached = {
  id: string;
  notebook_id: string;
  visibility: "teacher_only" | "student_access_enabled";
  notebook: Notebook | null;
};

const NOTEBOOK_FIELDS = "id, title, teacher, class_name, session, subject, subtopic, color_index";

const ClassLessonNotesPage = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [className, setClassName] = useState("");
  const [attached, setAttached] = useState<Attached[]>([]);
  const [available, setAvailable] = useState<Notebook[]>([]);
  const [picker, setPicker] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!classId) return;
    const { data: cls } = await supabase.from("classes").select("name").eq("id", classId).single();
    if (cls) setClassName(cls.name);

    const { data: links } = await supabase
      .from("class_lesson_notes")
      .select("id, notebook_id, visibility")
      .eq("class_id", classId)
      .order("added_at", { ascending: false });
    const ids = (links ?? []).map((l) => l.notebook_id);
    const notebooks = ids.length
      ? (await supabase.from("notebooks").select(NOTEBOOK_FIELDS).in("id", ids)).data ?? []
      : [];
    setAttached(
      (links ?? []).map((l) => ({
        id: l.id,
        notebook_id: l.notebook_id,
        visibility: l.visibility as Attached["visibility"],
        notebook: (notebooks.find((n) => n.id === l.notebook_id) as Notebook | undefined) ?? null,
      })),
    );
  }, [classId]);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=/teaching-hub/classes/${classId}/lesson-notes`);
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

  const openPicker = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const { data: nbs } = await supabase
      .from("notebooks")
      .select(NOTEBOOK_FIELDS)
      .eq("owner_id", userData.user!.id)
      .order("updated_at", { ascending: false });
    const attachedIds = new Set(attached.map((a) => a.notebook_id));
    setAvailable(((nbs ?? []) as Notebook[]).filter((n) => !attachedIds.has(n.id)));
    setSelected(new Set());
    setPicker(true);
  };

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const addToClass = async () => {
    if (selected.size === 0) return;
    const rows = Array.from(selected).map((notebook_id) => ({ class_id: classId!, notebook_id }));
    const { error } = await supabase.from("class_lesson_notes").insert(rows);
    if (error) {
      toast({ title: "Could not attach", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Added ${selected.size} note${selected.size > 1 ? "s" : ""} to class` });
    setPicker(false);
    load();
  };

  const toggleVisibility = async (row: Attached) => {
    const next = row.visibility === "teacher_only" ? "student_access_enabled" : "teacher_only";
    await supabase.from("class_lesson_notes").update({ visibility: next }).eq("id", row.id);
    load();
  };

  const detach = async (row: Attached) => {
    await supabase.from("class_lesson_notes").delete().eq("id", row.id);
    load();
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to={`/teaching-hub/classes/${classId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Class
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">Lesson Notes · {className}</h1>
        <button onClick={openPicker} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Add To Class
        </button>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {attached.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            No lesson notes attached to this class yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {attached.map((row) => {
              if (!row.notebook) return null;
              const enabled = row.visibility === "student_access_enabled";
              return (
                <div key={row.id} className="relative">
                  <NotebookCover notebook={row.notebook} />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 rounded-b-md bg-black/60 px-2 py-1.5 backdrop-blur-sm">
                    <button
                      onClick={() => toggleVisibility(row)}
                      className={`inline-flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium ${
                        enabled ? "bg-green-500/80 text-white" : "bg-white/10 text-white/80"
                      }`}
                    >
                      {enabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {enabled ? "Visible" : "Teacher Only"}
                    </button>
                    <button
                      onClick={() => detach(row)}
                      className="rounded-md bg-white/10 p-1 text-white/80 hover:bg-destructive/80"
                      aria-label="Remove from class"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {picker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur" onClick={() => setPicker(false)}>
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-border px-5 py-4">
              <div className="text-base font-semibold">Select lesson notes</div>
              <div className="text-xs text-muted-foreground">Tap notebooks to select. They won't open — just tap to add.</div>
            </div>
            <div className="flex-1 overflow-auto p-5">
              {available.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No more notes available to attach.</div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {available.map((n) => {
                    const isSel = selected.has(n.id);
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => toggle(n.id)}
                        className={`group relative block w-full rounded-md transition ${isSel ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""}`}
                      >
                        <NotebookCover notebook={n} />
                        {isSel && (
                          <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                            <Check className="h-4 w-4" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <button onClick={() => setPicker(false)} className="rounded-md border border-border px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={addToClass} disabled={selected.size === 0} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
                Add To Class{selected.size > 0 ? ` (${selected.size})` : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassLessonNotesPage;
