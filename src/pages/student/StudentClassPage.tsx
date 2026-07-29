import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Sparkles, Loader2, ClipboardList, Check, Gamepad2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { joinClassPresence } from "@/lib/realtime/classPresence";
import { listClassGames, type ClassGameRow } from "@/lib/games/classGames";
import { prefetchGame } from "@/lib/games/prefetch";

type ClassRow = { id: string; name: string };
type LessonNote = { notebook_id: string; notebooks: { title: string | null } | null };
type AssignmentGroup = {
  notebookId: string;
  title: string;
  subtopic: string | null;
  scoreLabel: string;
  questionCount: number;
  totalMarks: number;
  totalScore: number;
  completedCount: number;
  assignedAt: string | null;
  dueAt: string | null;
};


// A reusable workspace tile — fixed header, scrollable inner list, consistent
// height so the 2×2 grid stays balanced regardless of list length.
const Tile = ({
  icon,
  label,
  count,
  children,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  children: React.ReactNode;
  accent: string;
}) => (
  <section
    className={`rounded-2xl border ${accent} p-5 backdrop-blur flex flex-col min-h-[16rem]`}
  >
    <div className="mb-3 flex items-center justify-between">
      <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      {typeof count === "number" && (
        <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
          {count}
        </span>
      )}
    </div>
    <div className="flex-1 overflow-y-auto pr-1">{children}</div>
  </section>
);

const StudentClassPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cls, setCls] = useState<ClassRow | null>(null);
  const [notes, setNotes] = useState<{ id: string; title: string }[]>([]);
  const [assignments, setAssignments] = useState<AssignmentGroup[]>([]);
  const [games, setGames] = useState<ClassGameRow[]>([]);


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
      .select("id, title, kind, score_label, total_marks, notebook_id, assigned_at, due_at, unassigned_at")
      .eq("class_id", classId)
      .is("unassigned_at", null);
    const visible = ((rows ?? []) as any[]).filter((r) => r.kind !== "adventure" && r.notebook_id);
    const ids = visible.map((r) => r.id as string);

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

    const notebookIds = Array.from(new Set(visible.map((r) => r.notebook_id as string)));
    const nbMap = new Map<string, { title: string | null; subtopic: string | null }>();
    if (notebookIds.length) {
      const { data: nbs } = await supabase
        .from("notebooks")
        .select("id, title, subtopic")
        .in("id", notebookIds);
      for (const n of (nbs ?? []) as any[]) nbMap.set(n.id as string, { title: n.title ?? null, subtopic: n.subtopic ?? null });
    }

    const grouped = new Map<string, AssignmentGroup>();
    for (const r of visible) {
      const nbId = r.notebook_id as string;
      const meta = nbMap.get(nbId);
      const g = grouped.get(nbId) ?? {
        notebookId: nbId,
        title: meta?.title ?? r.title ?? "Assignment",
        subtopic: meta?.subtopic ?? null,
        scoreLabel: (r.score_label as string) || "Marks",
        questionCount: 0,
        totalMarks: 0,
        totalScore: 0,
        completedCount: 0,
        assignedAt: null,
        dueAt: null,
      };
      g.questionCount += 1;
      g.totalMarks += Number(r.total_marks ?? 0);
      const p = progByAssessment.get(r.id as string);
      g.totalScore += p?.score ?? 0;
      if (p?.status === "completed") g.completedCount += 1;
      if (r.assigned_at && (!g.assignedAt || r.assigned_at < g.assignedAt)) g.assignedAt = r.assigned_at as string;
      if (r.due_at && (!g.dueAt || r.due_at < g.dueAt)) g.dueAt = r.due_at as string;
      grouped.set(nbId, g);
    }
    setAssignments(Array.from(grouped.values()));
  }, [classId]);


  const loadGames = useCallback(async () => {
    if (!classId) return;
    try {
      const g = await listClassGames(classId);
      setGames(g);
      for (const row of g) void prefetchGame(classId, row.id);
    } catch {
      setGames([]);
    }
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
      await Promise.all([loadNotes(), loadAssignments(), loadGames()]);
      if (cancelled) return;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [classId, navigate, loadNotes, loadAssignments, loadGames]);

  useEffect(() => {
    if (!classId) return;
    let handle: Awaited<ReturnType<typeof joinClassPresence>> | null = null;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      handle = await joinClassPresence(classId, uid);
    })();
    return () => { cancelled = true; handle?.unsubscribe(); };
  }, [classId]);

  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`class-notes-${classId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "class_lesson_notes", filter: `class_id=eq.${classId}` },
          () => { loadNotes(); },
        )
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [classId, loadNotes]);

  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`class-assessments-${classId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "assessments", filter: `class_id=eq.${classId}` },
          () => { loadAssignments(); },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "class_game_boards", filter: `class_id=eq.${classId}` },
          () => { loadAssignments(); loadGames(); },
        )
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [classId, loadAssignments, loadGames]);

  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`class-games-${classId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "class_games", filter: `class_id=eq.${classId}` },
          () => { loadGames(); },
        )
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [classId, loadGames]);

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

      <main className="mx-auto w-full max-w-5xl px-6 py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Tile
            icon={<BookOpen className="h-3.5 w-3.5" />}
            label="Class Notes"
            count={notes.length}
            accent="border-border bg-card/40"
          >
            {notes.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                No lesson note selected.
              </div>
            ) : (
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li key={n.id}>
                    <Link
                      to={`/lesson-notes/${n.id}`}
                      className="block rounded-xl border border-border bg-background/40 p-3 transition hover:border-primary/40"
                    >
                      <div className="truncate text-sm font-semibold">{n.title}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">Read-only</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Tile>

          <Tile
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="SmartBoard"
            accent="border-violet-300/40 bg-gradient-to-br from-violet-400/15 to-violet-600/5"
          >
            <Link
              to={`/student/class/${classId}/smartboard`}
              className="flex h-full flex-col justify-center rounded-xl border border-violet-300/30 bg-background/30 p-4 text-left transition hover:border-violet-400/60"
            >
              <div className="text-base font-semibold">Open SmartBoard</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Follow what your teacher is showing in real time.
              </p>
            </Link>
          </Tile>

          <Tile
            icon={<ClipboardList className="h-3.5 w-3.5" />}
            label="Assignments"
            count={assignments.length}
            accent="border-border bg-card/40"
          >
            {assignments.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                No assignments yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {assignments.map((a) => {
                  const allDone = a.completedCount === a.questionCount && a.questionCount > 0;
                  const fmt = (v: string | null) => (v ? new Date(v).toLocaleDateString() : "—");
                  return (
                    <li key={a.notebookId}>
                      <Link
                        to={`/student/class/${classId}/assignment/${a.notebookId}`}
                        className="block rounded-xl border border-border bg-background/40 p-3 transition hover:border-primary/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{a.title}</div>
                            {a.subtopic && (
                              <div className="truncate text-[11px] text-muted-foreground">{a.subtopic}</div>
                            )}
                          </div>
                          {allDone && <Check className="h-4 w-4 shrink-0" style={{ color: "hsl(142 70% 45%)" }} />}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
                          <span>{a.questionCount} question{a.questionCount === 1 ? "" : "s"}</span>
                          <span>{a.totalScore} / {a.totalMarks} {a.scoreLabel}</span>
                          <span>Assigned {fmt(a.assignedAt)}</span>
                          <span>Due {fmt(a.dueAt)}</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Tile>

          <Tile
            icon={<Gamepad2 className="h-3.5 w-3.5" />}
            label="Adventures"
            count={games.length}
            accent="border-emerald-300/40 bg-gradient-to-br from-emerald-400/15 to-emerald-600/5"
          >
            {games.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                No adventures yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {games.map((g) => (
                  <li key={g.id}>
                    <Link
                      to={`/student/class/${classId}/games/${g.id}/play`}
                      className="block rounded-xl border border-emerald-300/30 bg-background/30 p-3 transition hover:border-emerald-400/60"
                    >
                      <div className="truncate text-sm font-semibold">{g.title}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">Tap to play</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Tile>

          <Tile
            icon={<ImageIcon className="h-3.5 w-3.5" />}
            label="Gallery"
            accent="border-amber-300/40 bg-gradient-to-br from-amber-400/15 to-amber-600/5"
          >
            <Link
              to={`/student/class/${classId}/gallery`}
              className="flex h-full items-center justify-center rounded-xl border border-amber-300/30 bg-background/30 p-4 text-center text-sm font-semibold transition hover:border-amber-400/60"
            >
              Open class gallery
            </Link>
          </Tile>

          <Tile
            icon={<BarChart3 className="h-3.5 w-3.5" />}
            label="Report"
            accent="border-sky-300/40 bg-gradient-to-br from-sky-400/15 to-sky-600/5"
          >
            <Link
              to={`/student/class/${classId}/report`}
              className="flex h-full flex-col justify-center rounded-xl border border-sky-300/30 bg-background/30 p-4 text-left transition hover:border-sky-400/60"
            >
              <div className="text-base font-semibold">My progress report</div>
              <p className="mt-1 text-xs text-muted-foreground">
                One bar for every assignment and adventure, from 0% to 100%.
              </p>
            </Link>
          </Tile>
        </div>
      </main>
    </div>
  );
};

export default StudentClassPage;
