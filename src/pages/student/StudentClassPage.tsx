import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { viewOwnerId } from "@/lib/accounts/workspaceScope";
import { ArrowLeft, BookOpen, Sparkles, Loader2, ClipboardList, Check, Gamepad2, Image as ImageIcon, BarChart3, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { joinClassPresence } from "@/lib/realtime/classPresence";
import { listClassGames, type ClassGameRow } from "@/lib/games/classGames";
import { prefetchGame } from "@/lib/games/prefetch";
import { getClassLevels } from "@/lib/classes/contentHierarchy";
import GatewayGate from "@/components/gateway/GatewayGate";
import { sectionCardStyle, type SectionThemeKey } from "@/lib/theme/sectionThemes";
import ComingSoonPanel from "@/components/schedule/ComingSoonPanel";
import SchedulePlanPanel from "@/components/schedule/SchedulePlanPanel";
import { EMPTY_CLASS_MEETING, loadClassMeeting, type ClassMeeting } from "@/lib/classes/classMeeting";
import { listPlanEntries, type SchedulePlanEntry } from "@/lib/schedule/plan";



type ClassRow = { id: string; name: string; owner_id: string };
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


// A reusable workspace tile — premium themed surface (same design language as
// the teacher workspace), fixed header, scrollable inner list, consistent
// height so the grid stays balanced regardless of list length.
const Tile = ({
  icon,
  label,
  count,
  children,
  theme,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  children: React.ReactNode;
  theme: SectionThemeKey;
}) => (
  <section
    className="flex min-h-[16rem] flex-col rounded-2xl border border-section-ink/15 p-5 text-section-ink"
    style={sectionCardStyle(theme)}
  >
    <div className="mb-3 flex items-center justify-between">
      <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-section-ink/70">
        {icon} {label}
      </div>
      {typeof count === "number" && (
        <span className="rounded-full bg-section-ink/10 px-2 py-0.5 text-[10px] tabular-nums text-section-ink/70">
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
  const [noteLevels, setNoteLevels] = useState<string[]>([]);
  const [meeting, setMeeting] = useState<ClassMeeting>(EMPTY_CLASS_MEETING);
  const [planEntries, setPlanEntries] = useState<SchedulePlanEntry[]>([]);

  useEffect(() => {
    if (!classId) return;
    void getClassLevels(classId).then(setNoteLevels);
  }, [classId]);

  // When and where the class meets, and what is coming next — visible without
  // waiting for the teacher to start anything.
  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    (async () => {
      const [loaded, plan] = await Promise.all([
        loadClassMeeting(classId),
        listPlanEntries("class", classId),
      ]);
      if (cancelled) return;
      setMeeting(loaded);
      setPlanEntries(plan);
    })();
    return () => {
      cancelled = true;
    };
  }, [classId]);




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
    // In a school's read-only view this is the student being viewed.
    const uid = userData.user?.id ? viewOwnerId(userData.user.id) : undefined;
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
      const uid = viewOwnerId(userData.user.id);

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
        .select("id, name, owner_id")
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

  const body = (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <Link
          to="/student/classes"
          className="inline-flex min-h-[44px] min-w-0 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="truncate">My Classes</span>
        </Link>
        <h1 className="max-w-[55vw] truncate text-base font-semibold tracking-wide sm:text-lg">{cls?.name}</h1>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          <Tile
            icon={<BookOpen className="h-3.5 w-3.5" />}
            label="Class Notes"
            count={notes.length}
            theme="lessonNotes"
          >
            {noteLevels.length > 0 ? (
              <Link
                to={`/student/class/${classId}/lesson-notes`}
                className="flex h-full flex-col justify-center rounded-xl border border-section-ink/20 bg-white/10 p-4 transition hover:border-section-ink/45"
              >
                <div className="text-base font-semibold">Browse lesson notes</div>
                <p className="mt-1 text-xs text-section-ink/70">
                  Organised by your teacher — tap to explore.
                </p>
              </Link>
            ) : notes.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-section-ink/25 p-4 text-center text-xs text-section-ink/70">
                No lesson note selected.
              </div>
            ) : (
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li key={n.id}>
                    <Link
                      to={`/lesson-notes/${n.id}`}
                      className="block rounded-xl border border-section-ink/20 bg-white/10 p-3 transition hover:border-section-ink/45"
                    >
                      <div className="truncate text-sm font-semibold">{n.title}</div>
                      <div className="mt-0.5 text-[11px] text-section-ink/70">Read-only</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

          </Tile>

          <Tile
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="SmartBoard"
            theme="smartboard"
          >
            <Link
              to={`/student/class/${classId}/smartboard`}
              className="flex h-full flex-col justify-center rounded-xl border border-section-ink/20 bg-white/10 p-4 text-left transition hover:border-section-ink/20"
            >
              <div className="text-base font-semibold">Open SmartBoard</div>
              <p className="mt-1 text-xs text-section-ink/70">
                Follow what your teacher is showing in real time.
              </p>
            </Link>
          </Tile>

          <Tile
            icon={<ClipboardList className="h-3.5 w-3.5" />}
            label="Assignments"
            count={assignments.length}
            theme="assignments"
          >
            {assignments.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-section-ink/25 p-4 text-center text-xs text-section-ink/70">
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
                        className="block rounded-xl border border-section-ink/20 bg-white/10 p-3 transition hover:border-section-ink/45"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{a.title}</div>
                            {a.subtopic && (
                              <div className="truncate text-[11px] text-section-ink/70">{a.subtopic}</div>
                            )}
                          </div>
                          {allDone && <Check className="h-4 w-4 shrink-0" style={{ color: "hsl(142 70% 45%)" }} />}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-section-ink/70 tabular-nums">
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
            theme="adventure"
          >
            {games.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-section-ink/25 p-4 text-center text-xs text-section-ink/70">
                No adventures yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {games.map((g) => (
                  <li key={g.id}>
                    <Link
                      to={`/student/class/${classId}/games/${g.id}/play`}
                      className="block rounded-xl border border-section-ink/20 bg-white/10 p-3 transition hover:border-section-ink/20"
                    >
                      <div className="truncate text-sm font-semibold">{g.title}</div>
                      <div className="mt-0.5 text-[11px] text-section-ink/70">Tap to play</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Tile>

          <Tile
            icon={<GraduationCap className="h-3.5 w-3.5" />}
            label="Courses"
            theme="courses"
          >
            <Link
              to={`/student/class/${classId}/courses`}
              className="flex h-full flex-col justify-center rounded-xl border border-section-ink/20 bg-white/10 p-4 text-left transition hover:border-section-ink/20"
            >
              <div className="text-base font-semibold">My courses</div>
              <p className="mt-1 text-xs text-section-ink/70">
                The learning pathway your teacher prepared.
              </p>
            </Link>
          </Tile>

          <Tile
            icon={<ImageIcon className="h-3.5 w-3.5" />}
            label="Gallery"
            theme="gallery"
          >
            <Link
              to={`/student/class/${classId}/gallery`}
              className="flex h-full items-center justify-center rounded-xl border border-section-ink/20 bg-white/10 p-4 text-center text-sm font-semibold transition hover:border-section-ink/20"
            >
              Open class gallery
            </Link>
          </Tile>

          <Tile
            icon={<BarChart3 className="h-3.5 w-3.5" />}
            label="Report"
            theme="reports"
          >
            <Link
              to={`/student/class/${classId}/report`}
              className="flex h-full flex-col justify-center rounded-xl border border-section-ink/20 bg-white/10 p-4 text-left transition hover:border-section-ink/20"
            >
              <div className="text-base font-semibold">My progress report</div>
              <p className="mt-1 text-xs text-section-ink/70">
                One bar for every assignment and adventure, from 0% to 100%.
              </p>
            </Link>
          </Tile>
        </div>
      </main>
    </div>
  );

  return <GatewayGate ownerId={cls?.owner_id ?? null}>{body}</GatewayGate>;
};

export default StudentClassPage;
