import { classRoot } from "@/lib/product/workspaceRoutes";
// Teacher — Adventure Dashboard for a single class+game.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
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
import { useAdventureGroups } from "@/hooks/useAdventureGroups";
import { GroupsPanel } from "@/components/adventures/GroupsPanel";
import { withGroupBars, isGroupBarElementId } from "@/lib/adventures/groupBars";
import { moveGroupBar } from "@/lib/adventures/groups";
import { useGameTimeBar } from "@/hooks/useGameTimeBar";
import { useGroupOutcome } from "@/hooks/useGroupOutcome";
import { adventureModeOf, normalizeCanvas } from "@/lib/games/types";
import { useRewardTransfer } from "@/hooks/useRewardTransfer";

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
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);

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

  const groups = useAdventureGroups(classId, gameId);

  // Duplicated group bars are rebuilt from the original bar at render time, so
  // they inherit every setting of the original and never touch the Adventure.
  const gameWithGroups = useMemo(() => withGroupBars(game, groups.groups), [game, groups.groups]);

  // Bar scope: group-owned bars count only their group's students; whole-class
  // bars count only students not in any group.
  const barScope = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const g of groups.groups) {
      map.set(g.progress_element_id, groups.studentsByGroup.get(g.id) ?? new Set());
    }
    return map;
  }, [groups.groups, groups.studentsByGroup]);

  const sync = useAdventureSync({
    classId,
    gameId,
    game: gameWithGroups,
    boards,
    onGameUpdated: handleGameUpdated,
    barScope,
  });
  const refreshAdventureSync = sync.refresh;

  // For every whole-class bar, restrict scope to students not in any group.
  const wholeClassSet = useMemo(() => {
    const s = new Set<string>();
    for (const uid of sync.memberIds) if (!groups.studentGroup.has(uid)) s.add(uid);
    return s;
  }, [sync.memberIds, groups.studentGroup]);

  // Bars without a group entry are re-scoped to the whole class locally.
  const patchedBarSummaries = useMemo(() => {
    return sync.barSummaries.map((b) => {
      if (groups.barOwner.has(b.id)) return b;
      const students = wholeClassSet.size;
      const grand = (b.total || 0) * students;
      const required = Math.max(1, Math.round(grand * (b.goalPct / 100)));
      const raw = sync.scoresByAssessment[b.assessmentId] ?? {};
      let ach = 0;
      for (const [sid, sc] of Object.entries(raw)) if (wholeClassSet.has(sid)) ach += sc ?? 0;
      const per = required / Math.max(1, b.segments);
      return {
        ...b,
        students,
        grand,
        required,
        achieved: Math.min(required, ach),
        perSlot: Number.isInteger(per) ? String(per) : per.toFixed(1),
      };
    });
  }, [sync.barSummaries, groups.barOwner, wholeClassSet, sync.scoresByAssessment]);

  const statsByBar = useMemo(() => new Map(patchedBarSummaries.map((b) => [b.id, b])), [patchedBarSummaries]);

  const timeBar = useGameTimeBar(gameId);

  const canvas = useMemo(() => (game ? normalizeCanvas(game.canvas) : null), [game]);
  const mode = canvas ? adventureModeOf(canvas) : "static";

  // The dashboard is the single writer of competition outcomes.
  const outcome = useGroupOutcome({
    classId,
    gameId,
    mode: mode === "video" ? "video" : "static",
    sceneId: canvas?.activeSceneId ?? null,
    groups: groups.groups,
    statsByBar,
    timeExpired: timeBar.expired,
    authoritative: true,
    onChanged: groups.refresh,
  });

  // Part 1/6 — the first bar to reach its target sends its reward to that
  // group's Gallery; nothing transfers once the Time Bar has expired.
  const rewardRefs = useMemo(
    () => sync.elements.filter((el) => el.kind === "reward").map((el) => ({ id: el.id, label: el.label })),
    [sync.elements],
  );

  const transfer = useRewardTransfer({
    classId,
    gameId,
    barSummaries: patchedBarSummaries,
    barOwner: groups.barOwner,
    timeExpired: timeBar.expired,
    galleryPath: `${classRoot()}/${classId}/gallery`,
    rewardElements: rewardRefs,
  });
  const timeUp = timeBar.expired && !transfer.won;

  // Step 2 — the teacher owns the time bar row, so pause it here on a win.
  const pausedForWinRef = useRef(false);
  useEffect(() => {
    if (!transfer.won || pausedForWinRef.current) return;
    if (!timeBar.running) return;
    pausedForWinRef.current = true;
    void timeBar.actions.pause().catch(() => { pausedForWinRef.current = false; });
  }, [transfer.won, timeBar.running, timeBar.actions]);


  const canvasElements = useMemo(() => {
    const targetId = timeBar.elementId;
    return sync.elements
      // A reward that already moved to the Gallery no longer exists here.
      .filter((el) => !(el.kind === "reward" && transfer.transferredIds.has(el.id)))
      .map((el) => {
        if (el.kind === "reward" && transfer.departing.has(el.id)) {
          const off = transfer.exitOffsets.get(el.id);
          return { ...el, y: el.y + (off?.dy ?? 0), opacity: off?.opacity ?? 1 };
        }
        if (!targetId || el.id !== targetId || el.kind !== "progress_bar" || !el.progress) return el;
        const segs = Math.max(1, Number(el.progress.segments) || 10);
        return { ...el, progress: { ...el.progress, currentMarks: timeBar.slotsLit(segs), totalMarks: segs } };
      });
  }, [sync.elements, timeBar.elementId, timeBar.slotsLit, transfer.departing, transfer.exitOffsets, transfer.transferredIds]);




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
      if (!userData.user) { navigate(`/auth?redirect=${classRoot()}/${classId}/adventures/${gameId}/dashboard`); return; }
      const redirect = await ensureClassOwner(classId, userData.user.id);
      if (redirect) { navigate(redirect, { replace: true }); return; }

      const bundle = getPrefetched(classId, gameId) ?? await prefetchGame(classId, gameId);
      if (!bundle) { navigate(`${classRoot()}/${classId}/adventures`, { replace: true }); return; }
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

  useEffect(() => {
    if (!classId || !gameId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    const snapshot = () => {
      const map: Record<string, { current: number; required: number }> = {};
      for (const b of patchedBarSummaries) map[b.id] = { current: b.achieved, required: b.required };
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
  }, [classId, gameId, patchedBarSummaries]);

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
    navigate(`${classRoot()}/${classId}/assessments/${first}/student/${studentId}?returnTo=${encodeURIComponent(`${classRoot()}/${classId}/adventures/${gameId}/dashboard`)}`);
  };

  return (
    <div className="min-h-screen w-full bg-[#0b0a16] text-foreground">
      <header className="flex items-center justify-between px-5 py-3">
        <Link to={`${classRoot()}/${classId}/adventures`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
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
          {patchedBarSummaries.length > 0 && (
            <div className="mx-auto mb-3 flex w-full max-w-[1500px] flex-wrap gap-2">
              {patchedBarSummaries.map((b) => (
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
          {(transfer.goalReached || transfer.transferring) && (
            <div className="mx-auto mb-3 flex w-full max-w-[1500px] flex-wrap items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-xs backdrop-blur">
              {transfer.transferring && (
                <span className="font-semibold text-primary">Goal reached — transferring reward…</span>
              )}
              {!transfer.transferring && transfer.blockedReason === "time_expired" && (
                <span className="font-semibold text-destructive">
                  Goal reached, but time had already expired — no reward transferred.
                </span>
              )}
              {!transfer.transferring && transfer.blockedReason === "already_awarded" && (
                <span className="font-semibold text-primary">
                  Goal reached — this reward is already in the Class Gallery.
                </span>
              )}
              {!transfer.transferring && transfer.blockedReason === "no_gallery" && (
                <>
                  <span className="font-semibold text-destructive">
                    This class does not have a Gallery yet. Please create a Class Gallery before
                    rewards can be transferred.
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate(`${classRoot()}/${classId}/gallery`)}
                    className="rounded border border-input bg-background px-2 py-1 font-medium hover:bg-accent"
                  >
                    Open Class Gallery
                  </button>
                </>
              )}
              {!transfer.transferring && transfer.blockedReason === "not_linked" && (
                <>
                  <span className="font-semibold text-destructive">
                    This reward has not yet been linked to this Class Gallery. Please link the
                    reward to the Class Gallery and configure its Start Position and End Position.
                  </span>
                  {transfer.unlinkedRewards.length === 0 ? (
                    <span className="text-muted-foreground">
                      Add a reward asset to this Adventure first.
                    </span>
                  ) : (
                    transfer.unlinkedRewards.map((el) => (
                      <button
                        key={el.id}
                        type="button"
                        onClick={() =>
                          navigate(
                            `${classRoot()}/${classId}/gallery?configureReward=${gameId}:${el.id}`,
                          )
                        }
                        className="rounded border border-input bg-background px-2 py-1 font-medium hover:bg-accent"
                      >
                        Link “{el.label || "Reward"}” to Class Gallery
                      </button>
                    ))
                  )}
                </>
              )}
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
                <GameCanvas
                  elements={canvasElements}
                  selectedId={selectedRewardId}
                  editable
                  onSelect={(id) => {
                    if (!id) { setSelectedRewardId(null); return; }
                    const el = canvasElements.find((e) => e.id === id);
                    setSelectedRewardId(el?.kind === "reward" ? id : null);
                  }}
                  onMove={(id, x, y) => {
                    // Only duplicated group bars are movable; position only.
                    if (!isGroupBarElementId(id)) return;
                    const g = groups.groups.find((gr) => gr.progress_element_id === id);
                    if (!g) return;
                    void moveGroupBar(g.id, x, y).then(() => groups.refresh());
                  }}
                  heightUnits={sync.heightUnits}
                />
                {timeUp && (
                  <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                    <div className="rounded-2xl border border-destructive/50 bg-background px-8 py-5 text-center shadow-2xl">
                      <div className="text-3xl font-black tracking-tight text-destructive">Time Up</div>
                      <p className="mt-1 text-sm text-muted-foreground">No reward awarded — the game is frozen.</p>
                    </div>
                  </div>
                )}

                {selectedRewardId && (() => {
                  const el = canvasElements.find((e) => e.id === selectedRewardId);
                  if (!el || el.kind !== "reward") return null;
                  return (
                    <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
                      <span className="text-xs">
                        <span className="text-muted-foreground">Reward · </span>
                        <span className="font-semibold">{el.label || "Reward"}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => classId && gameId && navigate(
                          `${classRoot()}/${classId}/gallery?configureReward=${gameId}:${selectedRewardId}`,
                        )}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Link to Class Gallery
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRewardId(null)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border hover:bg-accent"
                        aria-label="Close"
                      >
                        ×
                      </button>
                    </div>
                  );
                })()}
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
                {classId && gameId && (
                  <div className="mt-6 border-t border-border pt-4">
                    {outcome.winner && (
                      <div className="mb-3 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm font-semibold text-primary">
                        {outcome.winner.name} finished first and takes the reward.
                      </div>
                    )}
                    <GroupsPanel
                      classId={classId}
                      gameId={gameId}
                      game={game}
                      members={sync.members}
                      bars={patchedBarSummaries}
                      ctx={groups}
                      statsByBar={statsByBar}
                      reservedBarIds={timeBar.elementId ? new Set([timeBar.elementId]) : undefined}
                    />
                  </div>
                )}
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
