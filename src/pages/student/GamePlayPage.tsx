// Student — play an assigned game.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "@/lib/router-compat";
import { ArrowLeft, Check, Loader2, Maximize2, Minimize2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import GameCanvas from "@/components/gamebuilder/GameCanvas";
import { getPreset } from "@/lib/games/progressPresets";
import { checkpointAt, checkpointsOf, normalizeCanvas, type GameRow, type Scene } from "@/lib/games/types";
import VideoBackgroundLayer, { type VideoBackgroundHandle } from "@/components/gamebuilder/VideoBackgroundLayer";
import type { GameBoard } from "@/lib/games/gameQuestions";
import { getPrefetched, prefetchGame, updatePrefetchedGame, waitForSceneReady } from "@/lib/games/prefetch";
import { renderMathInline } from "@/lib/notebook/mathRender";
import { useAdventureSync } from "@/hooks/useAdventureSync";
import { useGameTimeBar } from "@/hooks/useGameTimeBar";
import { useAdventureGroups } from "@/hooks/useAdventureGroups";
import { useGroupOutcome } from "@/hooks/useGroupOutcome";
import { withGroupBars } from "@/lib/adventures/groupBars";
import { useRewardTransfer } from "@/hooks/useRewardTransfer";
import { isFinalStage, stageComplete, stageElementIds, stagesOf } from "@/lib/games/stages";
import { loopRegionFor, loopStateOf, type LoopState } from "@/lib/games/loopRuntime";
import { useNarrationPlayback } from "@/lib/games/narration";
import { narrationsOf } from "@/lib/games/types";




type MirrorSnapshot = Record<string, { current: number; required: number }>;

type Solved = Record<string, number>;
type PerQuestion = { score: number; status: "not_started" | "in_progress" | "completed" };

const perQuestionFrom = (board: GameBoard, solved: Solved | undefined): Record<string, PerQuestion> => {
  const out: Record<string, PerQuestion> = {};
  for (const q of board.questions) {
    const lines = q.lines ?? [];
    let score = 0, solvedCount = 0;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] as { lineId?: string | number };
      const slot = `${q.id}:${line.lineId ?? i}`;
      const earned = solved?.[slot];
      if (earned != null) { solvedCount += 1; score += Number(earned) || 0; }
    }
    const status: PerQuestion["status"] =
      solvedCount === 0 ? "not_started" : solvedCount >= lines.length ? "completed" : "in_progress";
    out[q.id] = { score, status };
  }
  return out;
};

const statusLabel = (s: PerQuestion["status"]) =>
  s === "completed" ? "Completed" : s === "in_progress" ? "In Progress" : "Not Started";

const GamePlayPage = () => {
  const { classId, gameId } = useParams<{ classId: string; gameId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialBarId = searchParams.get("bar");
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<GameRow | null>(null);
  const [boards, setBoards] = useState<GameBoard[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [openBarId, setOpenBarId] = useState<string | null>(initialBarId);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mirror, setMirror] = useState<MirrorSnapshot | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // ── Video Adventure runtime ─────────────────────────────────────
  const videoRef = useRef<VideoBackgroundHandle | null>(null);
  const [videoTime, setVideoTime] = useState(0);
  const [activeCpId, setActiveCpId] = useState<string | null>(null);
  const [doneCps, setDoneCps] = useState<Set<string>>(() => new Set());
  const [cpFailed, setCpFailed] = useState(false);
  const [cpSecondsLeft, setCpSecondsLeft] = useState<number | null>(null);

  const handleGameUpdated = useCallback((updated: GameRow) => {
    setGame(updated);
    if (classId && gameId) updatePrefetchedGame(classId, gameId, updated);
  }, [classId, gameId]);

  const groups = useAdventureGroups(classId, gameId);

  // Every group's duplicated bar is rebuilt from the original bar, so students
  // watch all the competing bars race on the same stage.
  const gameWithGroups = useMemo(() => withGroupBars(game, groups.groups), [game, groups.groups]);

  // Part 4 — a student's marks only raise their own group's bar.
  const barScope = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const g of groups.groups) {
      map.set(g.progress_element_id, groups.studentsByGroup.get(g.id) ?? new Set<string>());
    }
    return map;
  }, [groups.groups, groups.studentsByGroup]);

  const sync = useAdventureSync({
    classId,
    gameId,
    game: gameWithGroups,
    boards,
    currentUserId: me,
    onGameUpdated: handleGameUpdated,
    barScope,
  });


  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!classId || !gameId) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { navigate(`/auth?redirect=/student/class/${classId}/games/${gameId}/play`); return; }
      setMe(userData.user.id);
      const { data: membership } = await supabase
        .from("class_members").select("class_id")
        .eq("class_id", classId).eq("user_id", userData.user.id).maybeSingle();
      if (!membership) { navigate("/join"); return; }

      let bundle = getPrefetched(classId, gameId);
      if (!bundle) bundle = (await prefetchGame(classId, gameId)) ?? undefined;
      if (cancelled) return;
      if (!bundle) { navigate(`/student/class/${classId}`); return; }

      const { game: g, boards: b, urls } = bundle;

      await waitForSceneReady(g, urls);
      if (cancelled) return;

      setGame(g);
      setBoards(b);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [classId, gameId, navigate]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await rootRef.current?.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!classId || !gameId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`adventure-mirror-${classId}-${gameId}`, { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "bars" }, ({ payload }) => {
          setMirror((payload ?? {}) as MirrorSnapshot);
        })
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [classId, gameId]);

  const timeBar = useGameTimeBar(gameId);

  // ── One staged engine ───────────────────────────────────────────
  // A stage is a Scene (static adventure) or a Loop region (video adventure).
  // It owns every object inside it; only the FINAL stage opens the Gallery.
  const canvas = useMemo(() => (game ? normalizeCanvas(game.canvas) : null), [game]);
  const videoBg = canvas?.video ?? null;
  const stages = useMemo(() => (canvas ? stagesOf(canvas) : []), [canvas]);
  const [stageIdx, setStageIdx] = useState(0);
  const activeStage: Scene | null = videoBg
    ? stages.find((s) => s.id === activeCpId) ?? null
    : stages[Math.min(stageIdx, Math.max(0, stages.length - 1))] ?? null;

  // Group clone bars live outside the authored scene, so a clone belongs to
  // whichever stage holds its source bar.
  const stageIds = useMemo(() => {
    const ids = stageElementIds(activeStage);
    if (ids.size === 0) return ids;
    for (const g of groups.groups) {
      if (g.source_element_id && ids.has(g.source_element_id)) ids.add(g.progress_element_id);
    }
    return ids;
  }, [activeStage, groups.groups]);

  const staged = videoBg != null || stages.length > 1;
  const finalStage = isFinalStage(stages, activeStage?.id);
  const stageBars = useMemo(
    () => (staged ? sync.barSummaries.filter((b) => stageIds.has(b.id)) : sync.barSummaries),
    [staged, sync.barSummaries, stageIds],
  );

  const advancedRef = useRef<string | null>(null);
  /**
   * Video mode: a completed loop is not cut short. It keeps playing to its own
   * `loopEnd` and only then do its objects unmount and the journey travel on,
   * so the student never sees a jump.
   */
  const [exitingCpId, setExitingCpId] = useState<string | null>(null);
  /** Live playhead, read when the reward exit duration is calculated. */
  const videoTimeRef = useRef(0);
  /**
   * Some adventures end with a cinematic after the last Learning Point. In that
   * case the Gallery waits for the video to finish instead of opening the
   * moment the final reward is collected.
   */
  const [awardedIds, setAwardedIds] = useState<string[]>([]);
  const hasConclusion = useMemo(() => {
    if (!videoBg || stages.length === 0) return false;
    const last = stages[stages.length - 1];
    const dur = videoBg.duration ?? 0;
    return last?.loopEnd != null && dur > 0 && last.loopEnd < dur - 0.5;
  }, [videoBg, stages]);

  const advanceStage = useCallback(() => {
    const stage = activeStage;
    if (!stage || advancedRef.current === stage.id) return;
    advancedRef.current = stage.id;
    setOpenBarId(null);
    if (videoBg) {
      setExitingCpId(stage.id);
      setCpSecondsLeft(null);
    } else {
      setStageIdx((i) => Math.min(stages.length - 1, i + 1));
    }
  }, [activeStage, videoBg, stages.length]);


  // Part 1/6 — the bar that hits its target transfers this stage's reward.
  // Part 7 — nothing transfers once time is up.
  const rewardRefs = useMemo(
    () => sync.elements.filter((el) => el.kind === "reward").map((el) => ({ id: el.id, label: el.label })),
    [sync.elements],
  );

  /**
   * Automatic reward animation duration: Loop End − current playhead, so the
   * reward lands exactly as the video leaves the Learning Point.
   */
  const getExitMs = useCallback(() => {
    if (!videoBg || !activeStage || activeStage.loopEnd == null) return null;
    return Math.max(0, (activeStage.loopEnd - videoTimeRef.current) * 1000);
  }, [videoBg, activeStage]);

  const transfer = useRewardTransfer({
    classId,
    gameId,
    barSummaries: stageBars,
    barOwner: groups.barOwner,
    timeExpired: timeBar.expired,
    galleryPath: `/student/class/${classId}/gallery`,
    rewardElements: rewardRefs,
    stageRewardIds: staged ? stageIds : null,
    stageKey: activeStage?.id ?? "single",
    deferGallery: staged && (!finalStage || hasConclusion),
    onStageAwarded: (ids) => { setAwardedIds(ids); advanceStage(); },
    getExitMs,
  });

  // Time beat the goal (Part 7): expired with no valid, in-time win.
  const timeUp = timeBar.expired && !transfer.won;
  const myGroupId = me ? groups.studentGroup.get(me) ?? null : null;

  // Group outcome — a race winner (Adventure) or the encouraging message shown
  // to a group that did not reach the Learning Point target (Video Adventure).
  const statsByBar = useMemo(
    () => new Map(sync.barSummaries.map((b) => [b.id, b])),
    [sync.barSummaries],
  );
  const outcome = useGroupOutcome({
    classId,
    gameId,
    mode: videoBg ? "video" : "static",
    sceneId: activeStage?.id ?? null,
    groups: groups.groups,
    statsByBar,
    timeExpired: timeBar.expired,
  });
  const myGroup = myGroupId ? groups.groups.find((g) => g.id === myGroupId) ?? null : null;
  const waiting = !!myGroup && outcome.waitingGroupIds.has(myGroup.id);
  // The game only ends on the final stage; earlier wins just move on.
  // A waiting group watches the rest of the story; its board stays locked.
  const frozen = timeUp || waiting || (transfer.won && (!staged || finalStage));

  // Step 2 — stop the clock the moment the game is actually over.
  const pausedForWinRef = useRef(false);
  useEffect(() => {
    if (!transfer.won || (staged && !finalStage)) return;
    if (pausedForWinRef.current) return;
    if (!timeBar.running) return;
    pausedForWinRef.current = true;
    void timeBar.actions.pause().catch(() => { pausedForWinRef.current = false; });
  }, [transfer.won, staged, finalStage, timeBar.running, timeBar.actions]);

  const mirroredElements = useMemo(() => {
    const timeBarId = timeBar.elementId;
    return sync.elements
      // A reward that already lives in the Gallery no longer exists here.
      .filter((el) => !(el.kind === "reward" && transfer.transferredIds.has(el.id)))
      // Duration "None": the countdown is disabled, so the Time Bar is not
      // drawn at all and students play for as long as they need.
      .filter((el) => !(timeBar.noTime && timeBarId && el.id === timeBarId))
      .map((el) => {
        if (el.kind === "reward" && transfer.departing.has(el.id)) {
          const off = transfer.exitOffsets.get(el.id);
          // Continuous lift + fade at the Gallery's configured speed.
          return { ...el, y: el.y + (off?.dy ?? 0), opacity: off?.opacity ?? 1 };
        }
        if (el.kind !== "progress_bar" || !el.progress) return el;
        if (timeBarId && el.id === timeBarId) {
          const segs = Math.max(1, Number(el.progress.segments) || 10);
          return { ...el, progress: { ...el.progress, currentMarks: timeBar.slotsLit(segs), totalMarks: segs } };
        }
        const snap = mirror?.[el.id];
        if (!snap) return el;
        return { ...el, progress: { ...el.progress, currentMarks: snap.current, totalMarks: snap.required } };
      });
  }, [sync.elements, mirror, timeBar.elementId, timeBar.noTime, timeBar.slotsLit, transfer.departing, transfer.exitOffsets, transfer.transferredIds]);

  /**
   * Only the current stage exists on screen: reward, progress bar, time bar,
   * effects, characters, particles and floating objects all belong to it and
   * all disappear together the moment it completes.
   */
  const visibleElements = useMemo(() => {
    if (!staged) return mirroredElements;
    if (!activeStage) return [];
    const mine = mirroredElements.filter((e) => stageIds.has(e.id));
    // Completed Learning Point: the Progress Bar is no longer needed and
    // disappears at once, while the reward finishes travelling upward.
    if (videoBg && exitingCpId) return mine.filter((e) => e.kind !== "progress_bar");
    return mine;
  }, [staged, activeStage, stageIds, mirroredElements, videoBg, exitingCpId]);

  /**
   * Learning Point state, resolved by the shared runtime rules
   * (upcoming → active → completed → hidden). Developer signal only — never
   * rendered on the canvas.
   */
  const loopStates = useMemo(() => {
    if (!videoBg) return {} as Record<string, LoopState>;
    const out: Record<string, LoopState> = {};
    for (const s of stages) {
      out[s.title || s.id] = loopStateOf(s.id, {
        activeId: activeCpId,
        exitingId: exitingCpId,
        completedIds: doneCps,
      });
    }
    return out;
  }, [videoBg, stages, activeCpId, exitingCpId, doneCps]);
  useEffect(() => {
    if (videoBg) console.debug("[adventure] learning points", loopStates);
  }, [videoBg, loopStates]);


  const playableBars = useMemo(
    () =>
      visibleElements.filter((e) => {
        if (e.kind !== "progress_bar" || !sync.boardByElement.has(e.id)) return false;
        const owner = groups.barOwner.get(e.id);
        // Grouped bars are only playable by their own group's students.
        if (owner) return owner === myGroupId;
        return true;
      }),
    [visibleElements, sync.boardByElement, groups.barOwner, myGroupId],
  );
  const openBoard = sync.boardByElement.get(openBarId ?? "");
  const perQuestion = useMemo(
    () => (openBoard ? perQuestionFrom(openBoard, sync.mySolvedByAssessment[openBoard.assessmentId]) : {}),
    [openBoard, sync.mySolvedByAssessment],
  );

  // Freeze the board when time is up, a stage is handing over, or the game ended.
  useEffect(() => {
    if (frozen || transfer.transferring) setOpenBarId(null);
  }, [frozen, transfer.transferring]);

  const checkpoints = stages;
  const activeCp = videoBg ? activeStage : null;

  const narrations = useMemo(() => narrationsOf(canvas), [canvas]);
  // Gameplay: Play Once lasts the whole student session (one mounted game).
  const sessionRunId = useMemo(() => `${gameId ?? "game"}:${Date.now()}`, [gameId]);
  const narrationRuntime = useNarrationPlayback(narrations, Boolean(videoBg), sessionRunId);


  // Reaching a loop's start time freezes the journey into that loop.
  const onVideoTime = useCallback(
    (t: number) => {
      setVideoTime(t);
      videoTimeRef.current = t;
      narrationRuntime.onTime(t);
      // A cleared loop plays out its final seconds, then everything unmounts.
      if (exitingCpId) {
        const leaving = checkpoints.find((c) => c.id === exitingCpId);
        const end = leaving?.loopEnd ?? 0;
        if (t >= end - 0.05) {
          setDoneCps((prev) => new Set(prev).add(exitingCpId));
          setExitingCpId(null);
          setActiveCpId(null);
        }
        return;
      }
      if (activeCpId) return;
      const hit = checkpointAt(checkpoints, t);
      if (hit && !doneCps.has(hit.id)) {
        setActiveCpId(hit.id);
        setCpFailed(false);
        setCpSecondsLeft(hit.timerEnabled ? hit.timeLimit ?? 300 : null);
      }
    },
    [activeCpId, exitingCpId, checkpoints, doneCps, narrationRuntime],
  );


  // Per-stage countdown.
  useEffect(() => {
    if (!activeCp || cpSecondsLeft == null || cpFailed) return;
    if (cpSecondsLeft <= 0) { setCpFailed(true); return; }
    const t = window.setTimeout(() => setCpSecondsLeft((v) => (v == null ? v : v - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [activeCp, cpSecondsLeft, cpFailed]);

  /**
   * Stage complete with nothing left to transfer (no reward linked, or the
   * reward already left) — still hand over to the next stage. The final stage
   * never advances: the Gallery takes over there.
   */
  const stageDone = useMemo(
    () => (staged ? stageComplete(sync.barSummaries, stageIds) : false),
    [staged, sync.barSummaries, stageIds],
  );
  useEffect(() => {
    if (!stageDone || finalStage || transfer.transferring) return;
    const t = window.setTimeout(() => advanceStage(), 1400);
    return () => window.clearTimeout(t);
  }, [stageDone, finalStage, transfer.transferring, advanceStage]);

  /** Turn back — replay the previous loop's section of the journey. */
  const turnBack = useCallback(() => {
    const cps = checkpoints;
    const currentIdx = activeCp ? cps.findIndex((c) => c.id === activeCp.id) : -1;
    let target: Scene | null = null;
    if (currentIdx > 0) target = cps[currentIdx - 1];
    else if (currentIdx < 0) {
      const passed = cps.filter((c) => (c.loopEnd ?? 0) <= videoTime);
      target = passed.length > 0 ? passed[passed.length - 1] : null;
    }
    if (!target) return;
    advancedRef.current = null;
    setExitingCpId(null);

    setDoneCps((prev) => { const n = new Set(prev); n.delete(target!.id); return n; });
    setActiveCpId(target.id);
    setCpFailed(false);
    setCpSecondsLeft(target.timerEnabled ? target.timeLimit ?? 300 : null);
    videoRef.current?.seek(target.loopStart ?? 0);
  }, [checkpoints, activeCp, videoTime]);

  const retryCheckpoint = useCallback(() => {
    if (!activeCp) return;
    setCpFailed(false);
    setCpSecondsLeft(activeCp.timerEnabled ? activeCp.timeLimit ?? 300 : null);
    videoRef.current?.seek(activeCp.loopStart ?? 0);
  }, [activeCp]);


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening game…
      </div>
    );
  }

  const isOpen = !!openBarId && !!openBoard;

  return (
    <div ref={rootRef} className="min-h-screen w-full bg-[#0b0a16] text-foreground">
      {waiting && (
        <div className="mx-4 mt-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm text-foreground">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">{myGroup?.name}</div>
          <p className="mt-1">{outcome.message}</p>
        </div>
      )}
      {outcome.winner && !videoBg && (
        <div className="mx-4 mt-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm font-semibold text-primary">
          {outcome.winner.name} finished first and takes the reward.
        </div>
      )}
      <header className="flex items-center justify-between px-5 py-3">
        <Link to={`/student/class/${classId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Class
        </Link>
        <h1 className="truncate text-base font-semibold">{game?.title}</h1>
        <div className="flex items-center gap-2">
          {(() => {
            const myScore = me
              ? boards.reduce((s, b) => s + (sync.scoresByAssessment[b.assessmentId]?.[me] ?? 0), 0)
              : 0;
            const myTarget = Math.ceil(sync.requiredContribution || 0);
            return (
              <div className="flex flex-col items-end leading-tight">
                <div className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-sm font-semibold tabular-nums text-primary">
                  {myScore} / {myTarget}
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Your target</div>
              </div>
            );
          })()}

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <main className="w-full px-4 pb-6">
        <div className="mx-auto flex w-full max-w-[1400px] gap-4 transition-all duration-300">
          <div
            className="relative origin-top transition-all duration-300 animate-fade-in"
            style={{ width: isOpen ? "80%" : "100%" }}
          >
            {videoBg ? (
              <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "16 / 9" }}>
                <VideoBackgroundLayer
                  ref={videoRef}
                  video={videoBg}
                  playing={!frozen && !cpFailed && (!transfer.transferring || !!videoBg)}
                  loop={loopRegionFor(activeCp, Boolean(exitingCpId))}


                  onTime={onVideoTime}
                  onEnded={() => {
                    // Conclusion finished — the Gallery opens now, with only the
                    // newest reward animating into place.
                    if (!hasConclusion || awardedIds.length === 0) return;
                    const params = new URLSearchParams({
                      animateReward: `${gameId}:${awardedIds[0]}`,
                    });
                    if (transfer.winnerGroupId) params.set("group", transfer.winnerGroupId);
                    navigate(`/student/class/${classId}/gallery?${params.toString()}`);
                  }}
                />
                <div className="pointer-events-none absolute inset-0">
                  <GameCanvas
                    elements={visibleElements}
                    selectedId={null}
                    editable={false}
                    fill
                    transparent
                  />
                </div>
                {activeCp && (
                  <div className="absolute left-3 top-3 z-40 flex items-center gap-2 rounded-full border border-primary/40 bg-background/80 px-3 py-1 text-xs backdrop-blur">
                    <span className="font-semibold text-primary">{activeCp.title}</span>
                    {cpSecondsLeft != null && (
                      <span className="tabular-nums text-muted-foreground">
                        {Math.floor(Math.max(0, cpSecondsLeft) / 60)}:
                        {String(Math.max(0, cpSecondsLeft) % 60).padStart(2, "0")}
                      </span>
                    )}
                  </div>
                )}
                {checkpoints.length > 0 && (
                  <button
                    type="button"
                    onClick={turnBack}
                    className="absolute right-3 top-3 z-40 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs backdrop-blur hover:bg-accent"
                  >
                    Turn Back
                  </button>
                )}
                {cpFailed && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="rounded-xl border border-destructive/40 bg-background/90 px-8 py-5 text-center shadow-2xl">
                      <div className="text-lg font-bold text-destructive">Game Over</div>
                      <div className="mt-1 text-xs text-muted-foreground">Time ran out at this checkpoint.</div>
                      <button
                        type="button"
                        onClick={retryCheckpoint}
                        className="mt-3 rounded-md border border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                      >
                        Retry Checkpoint
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="pointer-events-none">
                <GameCanvas elements={visibleElements} selectedId={null} editable={false} />
              </div>
            )}

            <div className="pointer-events-none absolute inset-0 z-30">
              {!frozen && !transfer.transferring && playableBars.map((bar) => {

                const aspect = getPreset(bar.progress?.presetId)?.aspect ?? 0.5;
                return (
                  <button
                    key={bar.id}
                    type="button"
                    onClick={() => setOpenBarId(bar.id)}
                    aria-label="Open questions"
                    className="pointer-events-auto absolute rounded-lg outline-hidden ring-1 ring-primary/40 transition hover:ring-2 hover:ring-primary/80 focus-visible:ring-2 focus-visible:ring-primary"
                    style={{
                      left: `${bar.x * 100}%`,
                      top: `${bar.y * 100}%`,
                      width: `${bar.scale * 100}%`,
                      aspectRatio: String(aspect),
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                );
              })}
            </div>
            {playableBars.length === 0 && !frozen && (
              <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 mx-auto w-fit rounded-full border border-border/60 bg-background/80 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur">
                Your teacher hasn't linked questions to this game's progress bars yet.
              </div>
            )}
            {transfer.transferring && (
              <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="rounded-xl border border-primary/40 bg-background/90 px-6 py-4 text-center shadow-2xl">
                  <div className="text-sm font-semibold text-primary">
                    {staged && !finalStage ? (videoBg ? "Loop cleared!" : "Scene cleared!") : "Adventure complete!"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {staged && !finalStage
                      ? videoBg
                        ? "Reward stored — the journey continues…"
                        : "Reward stored — loading the next scene…"
                      : "Sending your reward to the Gallery…"}
                  </div>
                </div>
              </div>
            )}
            {!transfer.transferring && (!staged || finalStage) && transfer.goalReached && transfer.blockedReason && !timeUp && (

              <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="rounded-xl border border-primary/40 bg-background/90 px-6 py-4 text-center shadow-2xl">
                  <div className="text-sm font-semibold text-primary">Goal reached!</div>
                  <div className="mt-1 max-w-sm text-xs text-muted-foreground">
                    {transfer.blockedReason === "already_awarded"
                      ? "Your reward is already in the Class Gallery."
                      : transfer.blockedReason === "no_gallery"
                        ? "This class does not have a Gallery yet — ask your teacher to create one."
                        : "This reward has not yet been linked to this Class Gallery — ask your teacher to link it."}
                  </div>
                </div>
              </div>
            )}


            {timeUp && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="rounded-xl border border-destructive/40 bg-background/90 px-8 py-5 text-center shadow-2xl">
                  <div className="text-lg font-bold text-destructive">Time Up</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    The game has ended. No reward was awarded.
                  </div>
                </div>
              </div>
            )}

          </div>

          {isOpen && openBoard && (
            <aside
              className="flex-shrink-0 rounded-2xl border border-border bg-card/70 p-4 backdrop-blur transition-all duration-300"
              style={{ width: "20%", minWidth: 260 }}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Questions</div>
                  <div className="truncate text-sm font-semibold">{openBoard.title}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenBarId(null)}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border hover:bg-accent"
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {openBoard.questions.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No questions yet.</p>
              ) : (
                <ul className="space-y-2">
                  {openBoard.questions.map((q, i) => {
                    const marks = (q.lines ?? []).reduce((a, l) => a + (Number(l.marks) || 0), 0);
                    const pq = perQuestion[q.id] ?? { score: 0, status: "not_started" as const };
                    return (
                      <li key={q.id}>
                        <button
                          type="button"
                          onClick={() => {
                            navigate(`/student/class/${classId}/games/${gameId}/play?bar=${openBarId}`, { replace: true });
                            navigate(`/student/class/${classId}/assessment/${openBoard.assessmentId}?q=${q.id}&game=${gameId}&bar=${openBarId}&source=adventure`);
                          }}
                          className="block w-full rounded-lg border border-border bg-background/50 p-2.5 text-left transition hover:border-primary/50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold">Question {i + 1}</div>
                            {pq.status === "completed" && (
                              <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(142 70% 45%)" }} />
                            )}
                          </div>
                          <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                            {q.questionText ? renderMathInline(q.questionText) : "Tap to solve"}
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">{statusLabel(pq.status)}</span>
                            <span className="tabular-nums text-primary">{pq.score} / {marks}</span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </aside>
          )}
        </div>
      </main>
    </div>
  );
};

export default GamePlayPage;
