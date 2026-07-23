// Teacher — Adventure Dashboard for a single class+game. Shows the live game
// (read-only) with a right-side slide-out Assessment Dashboard identical to
// the Assignment Dashboard, scoped to the assessments linked to this game's
// progress bars.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Sparkles, ChevronRight, ChevronLeft, Maximize2, Minimize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";
import { AssessmentStatusPanel } from "@/components/dashboards/AssessmentStatusPanel";
import GameCanvas from "@/components/gamebuilder/GameCanvas";
import { getPrefetched, prefetchGame, updatePrefetchedGame, waitForSceneReady } from "@/lib/games/prefetch";
import { normalizeCanvas, type GameRow } from "@/lib/games/types";
import { loadClassGameBoards, type GameBoard } from "@/lib/games/gameQuestions";
import { useAdventureSync } from "@/hooks/useAdventureSync";
import { useGameTimeBar } from "@/hooks/useGameTimeBar";
import { TimeBarControl } from "@/components/adventures/TimeBarControl";

type ClassNameRow = { name: string | null };

const AdventureDashboardPage = () => {
  const { classId, gameId } = useParams<{ classId: string; gameId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<GameRow | null>(null);
  const [boards, setBoards] = useState<GameBoard[]>([]);
  const [className, setClassName] = useState<string>("");
  const [panelOpen, setPanelOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState<"none" | "game" | "panel">("none");

  useEffect(() => {
    if (fullscreen === "none") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen("none"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const handleGameUpdated = useCallback((updated: GameRow) => {
    setGame(updated);
    if (classId && gameId) updatePrefetchedGame(classId, gameId, updated);
  }, [classId, gameId]);

  const sync = useAdventureSync({
    classId,
    gameId,
    game,
    boards,
    onGameUpdated: handleGameUpdated,
  });
  const refreshAdventureSync = sync.refresh;

  const timeBar = useGameTimeBar(gameId);

  const canvasElements = useMemo(() => {
    if (!timeBar.elementId) return sync.elements;
    const targetId = timeBar.elementId;
    return sync.elements.map((el) => {
      if (el.id !== targetId || el.kind !== "progress_bar" || !el.progress) return el;
      const segs = Math.max(1, Number(el.progress.segments) || 10);
      return { ...el, progress: { ...el.progress, currentMarks: timeBar.slotsLit(segs), totalMarks: segs } };
    });
  }, [sync.elements, timeBar.elementId, timeBar.slotsLit]);

  const timeBarMeta = useMemo(() => {
    if (!timeBar.elementId) return null;
    const el = sync.elements.find((e) => e.id === timeBar.elementId);
    const label = el?.label || "Progress Bar";
    const segments = Math.max(1, Number(el?.progress?.segments) || 10);
    return { label, segments };
  }, [timeBar.elementId, sync.elements]);

  useEffect(() => {
    (async () => {
      if (!classId || !gameId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { navigate(`/auth?redirect=/teaching-hub/classes/${classId}/games/${gameId}/dashboard`); return; }
      const redirect = await ensureClassOwner(classId, userData.user.id);
      if (redirect) { navigate(redirect, { replace: true }); return; }

      const bundle = getPrefetched(classId, gameId) ?? await prefetchGame(classId, gameId);
      if (!bundle) { navigate(`/teaching-hub/classes/${classId}/adventures`, { replace: true }); return; }
      const { data: cls } = await supabase.from("classes").select("name").eq("id", classId).maybeSingle();

      await waitForSceneReady(bundle.game, bundle.urls);
      setGame(bundle.game);
      setBoards(bundle.boards);
      setClassName((cls as ClassNameRow | null)?.name ?? "");
      setLoading(false);
    })();
  }, [classId, gameId, navigate]);

  const reloadBoards = useCallback(async () => {
    if (!classId || !gameId) return;
    const b = await loadClassGameBoards(gameId, classId);
    setBoards(b);
    void refreshAdventureSync();
  }, [classId, gameId, refreshAdventureSync]);

  const reloadGame = useCallback(async () => {
    if (!gameId) return;
    const { data } = await supabase.from("games").select("*").eq("id", gameId).maybeSingle();
    if (data) setGame(data as unknown as GameRow);
  }, [gameId]);

  useEffect(() => {
    if (!classId || boards.length === 0) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`adventure-dashboard-boards-${gameId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "assessments" }, () => { void reloadBoards(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "notebook_subsections" }, () => { void reloadBoards(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "class_game_boards", filter: `class_id=eq.${classId}` }, () => { void reloadBoards(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, () => { void reloadGame(); })
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [classId, gameId, boards.length, reloadBoards, reloadGame]);

  // Mirror the teacher's live canvas to every student in this class+game via broadcast.
  useEffect(() => {
    if (!classId || !gameId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    const snapshot = () => {
      const map: Record<string, { current: number; required: number }> = {};
      for (const b of sync.barSummaries) map[b.id] = { current: b.achieved, required: b.required };
      return map;
    };
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase.channel(`adventure-mirror-${classId}-${gameId}`, { config: { broadcast: { self: false } } });
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void ch!.send({ type: "broadcast", event: "bars", payload: snapshot() });
        }
      });
    });
    const interval = window.setInterval(() => {
      if (!ch) return;
      void ch.send({ type: "broadcast", event: "bars", payload: snapshot() });
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      if (ch) supabase.removeChannel(ch);
    };
  }, [classId, gameId, sync.barSummaries]);

  const setBarGoalPct = useCallback(async (barElementId: string, pct: number) => {
    if (!game || !gameId) return;
    const clamped = Math.min(100, Math.max(1, Math.round(pct)));
    const canvas = normalizeCanvas(game.canvas);
    let changed = false;
    for (const s of canvas.scenes) {
      for (const el of s.elements) {
        if (el.id === barElementId && el.kind === "progress_bar" && el.progress) {
          el.progress = { ...el.progress, progressGoalPct: clamped };
          changed = true;
        }
      }
    }
    if (!changed) return;
    const nextGame = { ...game, canvas } as GameRow;
    setGame(nextGame);
    if (classId) updatePrefetchedGame(classId, gameId, nextGame);
    await supabase.from("games").update({ canvas: canvas as never } as never).eq("id", gameId);
    void refreshAdventureSync();
  }, [game, gameId, classId, refreshAdventureSync]);

  const onViewStudent = (studentId: string) => {
    const first = boards[0]?.assessmentId;
    if (!first) return;
    navigate(`/teaching-hub/classes/${classId}/assessments/${first}/student/${studentId}?returnTo=${encodeURIComponent(`/teaching-hub/classes/${classId}/games/${gameId}/dashboard`)}`);
  };

  return (
    <div className="min-h-screen w-full bg-[#0b0a16] text-foreground">
      <header className="flex items-center justify-between px-5 py-3">
        <Link to={`/teaching-hub/classes/${classId}/adventures`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Adventures
        </Link>
        <h1 className="inline-flex items-center gap-2 text-base font-semibold">
          <Sparkles className="h-4 w-4" /> {game?.title ?? "Adventure Dashboard"}
        </h1>
        <div className="w-24" />
      </header>

      {loading ? (
        <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading live game…
        </div>
      ) : (
        <main className="w-full px-4 pb-6">
          <div className="mx-auto mb-3 w-full max-w-[1500px] rounded-2xl border border-border bg-card/40 p-4 backdrop-blur">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <MetaField label="Class" value={className || "—"} />
              <MetaField label="Topic" value={game?.topic || "—"} />
              <MetaField label="Subtopic" value={game?.subtopic || "—"} />
              <MetaField label="Total Students" value={String(sync.studentCount)} hint="enrolled in class" />
              <MetaField label="Total Questions" value={String(boards.reduce((a, b) => a + b.questions.length, 0))} />
              <MetaField label="Total Marks" value={String(boards.reduce((a, b) => a + b.totalMarks, 0))} />
            </div>
          </div>
          {sync.barSummaries.length > 0 && (
            <div className="mx-auto mb-3 flex w-full max-w-[1500px] flex-wrap gap-2">
              {sync.barSummaries.map((b) => (
                <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs backdrop-blur">
                  <span className="font-medium">{b.label}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">Total {b.total}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">Students {b.students}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">Grand {b.grand}</span>
                  <span className="text-muted-foreground">· Goal</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={b.goalPct}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) void setBarGoalPct(b.id, v);
                    }}
                    className="h-6 w-14 rounded border border-input bg-background px-1.5 text-xs tabular-nums"
                    aria-label={`Progress goal % for ${b.label}`}
                  />
                  <span className="text-muted-foreground">%</span>
                  <span className="text-muted-foreground">· Achieved</span>
                  <span className="font-semibold text-primary tabular-nums">{b.achieved} / {b.required}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-semibold text-primary">{b.perSlot}/slot</span>
                  <span className="text-muted-foreground">({b.segments} slots)</span>
                </div>
              ))}
            </div>
          )}
          {gameId && timeBar.elementId && timeBarMeta && (
            <div className="mx-auto mb-3 w-full max-w-[1500px]">
              <TimeBarControl gameId={gameId} barLabel={timeBarMeta.label} segments={timeBarMeta.segments} />
            </div>
          )}
          <div className="mx-auto flex w-full max-w-[1500px] gap-4 transition-all duration-300">
            <div
              className={
                fullscreen === "game"
                  ? "fixed inset-0 z-50 flex items-center justify-center bg-[#0b0a16] p-4"
                  : "relative origin-top transition-all duration-300"
              }
              style={fullscreen === "game" ? undefined : { width: panelOpen ? "70%" : "100%" }}
            >
              <div className={fullscreen === "game" ? "relative w-full max-w-[1800px]" : "relative"}>
                <div className="pointer-events-none">
                  <GameCanvas elements={canvasElements} selectedId={null} editable={false} />
                </div>
                <button
                  type="button"
                  onClick={() => setFullscreen(fullscreen === "game" ? "none" : "game")}
                  className="pointer-events-auto absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/70 backdrop-blur hover:bg-accent"
                  aria-label={fullscreen === "game" ? "Exit fullscreen" : "Fullscreen game"}
                >
                  {fullscreen === "game" ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {panelOpen ? (
              <aside
                className={
                  fullscreen === "panel"
                    ? "fixed inset-0 z-50 overflow-auto rounded-none border-0 bg-card/95 p-6 backdrop-blur"
                    : "flex-shrink-0 rounded-2xl border border-border bg-card/80 p-4 backdrop-blur"
                }
                style={fullscreen === "panel" ? undefined : { width: "30%", minWidth: 320 }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Assessment Dashboard
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFullscreen(fullscreen === "panel" ? "none" : "panel")}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-accent"
                      aria-label={fullscreen === "panel" ? "Exit fullscreen" : "Fullscreen panel"}
                    >
                      {fullscreen === "panel" ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </button>
                    {fullscreen !== "panel" && (
                      <button
                        type="button"
                        onClick={() => setPanelOpen(false)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-accent"
                        aria-label="Hide panel"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <AssessmentStatusPanel rows={sync.rows} onViewStudent={onViewStudent} />
              </aside>
            ) : (
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                className="fixed right-2 top-1/2 z-30 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-l-md border border-border bg-background/80 hover:bg-accent"
                aria-label="Show panel"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
          </div>
        </main>
      )}
    </div>
  );
};

const MetaField = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="mt-0.5 text-sm font-semibold">{value}</div>
    {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
  </div>
);

export default AdventureDashboardPage;
