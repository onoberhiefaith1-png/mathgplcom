import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Sparkles, Loader2, ClipboardList, Check, Compass, Gamepad2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";

type ClassRow = { id: string; name: string };
type LessonNote = { notebook_id: string; notebooks: { title: string | null } | null };
type Assignment = {
  id: string;
  title: string;
  kind: string;
  score_label: string;
  total_marks: number;
  score: number;
  completed: boolean;
};

const StudentClassPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cls, setCls] = useState<ClassRow | null>(null);
  const [notes, setNotes] = useState<{ id: string; title: string }[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const loadNotes = useCallback(async () => {
    if (!classId) return;
    const { data: noteRows } = await supabase
      .from("class_lesson_notes")
      .select("notebook_id, notebooks:notebook_id(title)")
      .eq("class_id", classId)
      .eq("visibility", "student_access_enabled");
    setNotes(
      ((noteRows ?? []) as LessonNote[]).map((r) => ({
        id: r.notebook_id,
        title: r.notebooks?.title ?? "Untitled",
      })),
    );
  }, [classId]);

  const loadAssignments = useCallback(async () => {
    if (!classId) return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    const { data: rows } = await supabase
      .from("assessments")
      .select("id, title, kind, score_label, total_marks")
      .eq("class_id", classId)
      .order("created_at", { ascending: false });
    const ids = (rows ?? []).map((r: any) => r.id);
    const progByAssessment = new Map<string, { score: number; status: string }>();
    if (uid && ids.length) {
      const { data: progs } = await supabase
        .from("assessment_progress")
        .select("assessment_id, score, status")
        .eq("student_id", uid)
        .in("assessment_id", ids);
      for (const p of progs ?? []) {
        progByAssessment.set((p as any).assessment_id, { score: Number((p as any).score ?? 0), status: (p as any).status });
      }
    }
    setAssignments(
      (rows ?? []).map((r: any) => {
        const p = progByAssessment.get(r.id);
        return {
          id: r.id,
          title: r.title ?? "Assignment",
          kind: r.kind ?? "classwork",
          score_label: r.score_label ?? "Marks",
          total_marks: Number(r.total_marks ?? 0),
          score: p?.score ?? 0,
          completed: p?.status === "completed",
        };
      }),
    );
  }, [classId]);


  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!classId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=/student/class/${classId}`);
        return;
      }
      const uid = userData.user.id;

      // Identity firewall: must be an approved member
      const { data: membership } = await supabase
        .from("class_members")
        .select("class_id")
        .eq("class_id", classId)
        .eq("user_id", uid)
        .maybeSingle();
      if (!membership) {
        navigate("/join");
        return;
      }

      const { data: classRow } = await supabase
        .from("classes")
        .select("id, name")
        .eq("id", classId)
        .maybeSingle();
      if (!classRow) { navigate("/join"); return; }

      if (cancelled) return;
      setCls(classRow as ClassRow);
      await Promise.all([loadNotes(), loadAssignments()]);
      if (cancelled) return;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [classId, navigate, loadNotes, loadAssignments]);

  // Live: note grant / removal / visibility toggle reflects instantly.
  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`class-notes-${classId}`, { config: { private: true } })
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "class_lesson_notes", filter: `class_id=eq.${classId}` },
          () => { loadNotes(); },
        )
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [classId, loadNotes]);

  // Live: new assignments appear and scores refresh instantly.
  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`class-assessments-${classId}`, { config: { private: true } })
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "assessments", filter: `class_id=eq.${classId}` },
          () => { loadAssignments(); },
        )
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [classId, loadAssignments]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening classroom…
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/join" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> My Classes
        </Link>
        <h1 className="truncate text-lg font-semibold tracking-wide">{cls?.name}</h1>
        <div className="w-24" />
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-8 px-6 py-8">
        <section>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> SmartBoard
          </div>
          <Link
            to={`/student/class/${classId}/smartboard`}
            className="block rounded-2xl border border-violet-300/40 bg-gradient-to-br from-violet-400/20 to-violet-600/5 p-6 backdrop-blur transition hover:scale-[1.01] hover:shadow-2xl"
          >
            <div className="text-lg font-semibold">Open SmartBoard</div>
            <p className="mt-1 text-sm text-muted-foreground">View what your teacher is showing in real time.</p>
          </Link>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Compass className="h-3.5 w-3.5" /> Adventures
          </div>
          <Link
            to={`/student/class/${classId}/adventures`}
            className="block rounded-2xl border border-emerald-300/40 bg-gradient-to-br from-emerald-400/20 to-emerald-600/5 p-6 backdrop-blur transition hover:scale-[1.01] hover:shadow-2xl"
          >
            <div className="text-lg font-semibold">Open Adventures</div>
            <p className="mt-1 text-sm text-muted-foreground">Play the interactive lesson adventures assigned by your teacher.</p>
          </Link>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Gamepad2 className="h-3.5 w-3.5" /> Games
          </div>
          <Link
            to={`/student/class/${classId}/games`}
            className="block rounded-2xl border border-sky-300/40 bg-gradient-to-br from-sky-400/20 to-sky-600/5 p-6 backdrop-blur transition hover:scale-[1.01] hover:shadow-2xl"
          >
            <div className="text-lg font-semibold">Open Games</div>
            <p className="mt-1 text-sm text-muted-foreground">Play the games your teacher has assigned.</p>
          </Link>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" /> Class Notes
          </div>
          {notes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No lesson note selected.
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {notes.map((n) => (
                <li key={n.id}>
                  <Link
                    to={`/lesson-notes/${n.id}`}
                    className="block rounded-xl border border-border bg-card/40 p-4 backdrop-blur transition hover:border-primary/40"
                  >
                    <div className="truncate text-base font-semibold">{n.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Read-only</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ClipboardList className="h-3.5 w-3.5" /> Assessment Workspace
          </div>
          {assignments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No assignments yet.
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {assignments.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/student/class/${classId}/assessment/${a.id}`}
                    className="block rounded-xl border border-border bg-card/40 p-4 backdrop-blur transition hover:border-primary/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{a.kind}</div>
                        <div className="truncate text-base font-semibold">{a.title}</div>
                      </div>
                      {a.completed && <Check className="h-4 w-4 shrink-0" style={{ color: "hsl(142 70% 45%)" }} />}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground tabular-nums">
                      {a.score} / {a.total_marks} {a.score_label}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

    </div>
  );
};

export default StudentClassPage;
