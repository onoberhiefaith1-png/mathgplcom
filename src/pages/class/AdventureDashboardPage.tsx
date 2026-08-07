import { classRoot } from "@/lib/product/workspaceRoutes";
// Teacher — Adventure Dashboard for a single class+game.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import { ArrowLeft, Loader2, Sparkles, ChevronRight, ChevronLeft, Maximize2, Minimize2, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";
import { AssessmentStatusPanel } from "@/components/dashboards/AssessmentStatusPanel";
import GameCanvas from "@/components/gamebuilder/GameCanvas";
import { getPrefetched, prefetchGame, updatePrefetchedGame, waitForSceneReady } from "@/lib/games/prefetch";
import { normalizeCanvas, timeBarOf, sceneTimeSeconds, checkpointAt, checkpointsOf, type GameRow, type Scene } from "@/lib/games/types";
import VideoBackgroundLayer, { type VideoBackgroundHandle } from "@/components/gamebuilder/VideoBackgroundLayer";
import { loopRegionFor } from "@/lib/games/loopRuntime";
import { useVideoAdventureRun, DEFAULT_LP_DURATION_SECONDS, DEFAULT_REQUIRED_PCT } from "@/hooks/useVideoAdventureRun";
import { useNarrationPlayback } from "@/lib/games/narration";
import { useAdventureAudio } from "@/lib/games/adventureAudio";
import { unlockAudio } from "@/lib/games/audio";
import { narrationsOf } from "@/lib/games/types";
import { LearningPointTimeBars } from "@/components/adventures/LearningPointTimeBars";
import { loadClassGameBoards, type GameBoard } from "@/lib/games/gameQuestions";
import { useAdventureSync } from "@/hooks/useAdventureSync";
import { useAdventureGroups } from "@/hooks/useAdventureGroups";
import { GroupLeaderboard } from "@/components/adventures/GroupLeaderboard";
import { computeGroupStandings, fillByGroupOf, type MasterBar } from "@/lib/adventures/groupStandings";
import { buildGroupScoreboardBars, groupIdOfBarElementId } from "@/lib/adventures/groupBars";
import { moveGroupBar } from "@/lib/adventures/groups";
import { getGameMode, type GameMode } from "@/lib/adventures/gameMode";

import { useGameTimeBar, ensureTimeBar } from "@/hooks/useGameTimeBar";
import { useGroupOutcome } from "@/hooks/useGroupOutcome";
import { adventureModeOf } from "@/lib/games/types";
import { useRewardTransfer } from "@/hooks/useRewardTransfer";

import { TimeBarControl } from "@/components/adventures/TimeBarControl";

type ClassNameRow = { name: string | null };

/** m:ss for the two independent clocks (Game Time and Loop Time). */
const fmtClock = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

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
  // Video Adventure only — the dashboard is the live game screen.
  const videoRef = useRef<VideoBackgroundHandle | null>(null);
  const [exitingSceneId, setExitingSceneId] = useState<string | null>(null);
  const lastPublishRef = useRef(0);
  /**
   * Game Time — the master clock of the whole Video Adventure. It is the video's
   * own forward timeline and belongs to no Progress Bar. Loop Time (the
   * countdown of the Learning Point on screen) lives on the challenge row and is
   * completely independent of this.
   */
  const [gameTime, setGameTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  /** Restart Game is in flight: the loop is released so the video can reach 0:00. */
  const [restarting, setRestarting] = useState(false);
  /** Teacher is arranging the team scoreboard bars on the stage. */
  const [arrangeTeamBars, setArrangeTeamBars] = useState(false);

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

  // Groups no longer own gameplay objects: the stage always shows the one
  // master Progress Bar, and each team's progress is computed live from the
  // students assigned to it (Group Competition Board).
  const [gameMode, setGameMode] = useState<GameMode>("individual");
  useEffect(() => {
    if (!classId || !gameId) return;
    let cancelled = false;
    void getGameMode(classId, gameId).then((m) => { if (!cancelled) setGameMode(m); });
    return () => { cancelled = true; };
  }, [classId, gameId]);

  const sync = useAdventureSync({
    classId,
    gameId,
    game,
    boards,
    onGameUpdated: handleGameUpdated,
  });
  const refreshAdventureSync = sync.refresh;

  const patchedBarSummaries = sync.barSummaries;



  const timeBar = useGameTimeBar(gameId);

  const canvas = useMemo(() => (game ? normalizeCanvas(game.canvas) : null), [game]);
  const mode = canvas ? adventureModeOf(canvas) : "static";


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
      // Duration "None" — no countdown exists, so the Time Bar is not drawn.
      .filter((el) => !(timeBar.noTime && targetId && el.id === targetId))
      .map((el) => {
        if (el.kind === "reward" && transfer.departing.has(el.id)) {
          const off = transfer.exitOffsets.get(el.id);
          return { ...el, y: el.y + (off?.dy ?? 0), opacity: off?.opacity ?? 1 };
        }
        if (!targetId || el.id !== targetId || el.kind !== "progress_bar" || !el.progress) return el;
        const segs = Math.max(1, Number(el.progress.segments) || 10);
        return { ...el, progress: { ...el.progress, currentMarks: timeBar.slotsLit(segs), totalMarks: segs } };
      });
  }, [sync.elements, timeBar.elementId, timeBar.noTime, timeBar.slotsLit, transfer.departing, transfer.exitOffsets, transfer.transferredIds]);




  // The first Progress Bar of every Adventure is reserved as the Time Bar, so
  // the live row belongs to the engine — provision it instead of asking the
  // teacher to link one.
  const reservedTimeBar = useMemo(() => {
    const scene = canvas?.scenes?.find((s) => s.id === canvas?.activeSceneId) ?? canvas?.scenes?.[0] ?? null;
    const el = scene ? timeBarOf(scene.elements) : null;
    return el ? { el, seconds: sceneTimeSeconds(scene) } : null;
  }, [canvas]);

  useEffect(() => {
    if (!gameId || timeBar.loading || timeBar.row || !reservedTimeBar) return;
    void ensureTimeBar(gameId, reservedTimeBar.el.id, { durationSeconds: reservedTimeBar.seconds })
      .then(() => timeBar.refresh())
      .catch(() => {});
  }, [gameId, timeBar.loading, timeBar.row, timeBar.refresh, reservedTimeBar]);

  const timeBarMeta = useMemo(() => {
    const el = timeBar.elementId
      ? sync.elements.find((e) => e.id === timeBar.elementId)
      : reservedTimeBar?.el;
    const label = el?.label || "Progress Bar";
    const segments = Math.max(1, Number(el?.progress?.segments) || 10);
    return { label, segments };
  }, [timeBar.elementId, sync.elements, reservedTimeBar]);

  // ───────────────────────────────────────────────────────────────────────────
  // Video Adventure — the live, teacher-led game.
  //
  // The Game and the Time Bars are separate: `Start Game` runs the video, and a
  // Learning Point's Time Bar only exists while the video sits inside it.
  // Static Adventure is untouched by everything below.
  // ───────────────────────────────────────────────────────────────────────────
  const isVideo = mode === "video";
  const learningPoints = useMemo<Scene[]>(
    () => (canvas && isVideo ? checkpointsOf(canvas) : []),
    [canvas, isVideo],
  );
  const runtime = useVideoAdventureRun(classId, gameId, true);
  const activeScene = useMemo(
    () => learningPoints.find((s) => s.id === runtime.activeChallenge?.scene_id) ?? null,
    [learningPoints, runtime.activeChallenge],
  );
  const exitingScene = useMemo(
    () => learningPoints.find((s) => s.id === exitingSceneId) ?? null,
    [learningPoints, exitingSceneId],
  );
  const stageScene = activeScene ?? exitingScene;

  /** Group Mode turns each Learning Point into a timed competition. */
  const groupMode = gameMode === "group" && groups.groups.length > 0;


  /**
   * Live status of one Learning Point. Nothing is remembered between runs: the
   * grand total, the required mark and the achievement are recomputed from the
   * students currently enrolled and their current scores, so adding or removing
   * students, or changing the required mark, reopens or closes a point at once.
   */
  const pointSatisfied = useCallback(
    (sceneId: string): boolean => {
      const scene = learningPoints.find((s) => s.id === sceneId);
      if (!scene) return false;
      const ids = new Set((scene.elements ?? []).map((e) => e.id));
      const reservedId = timeBarOf(scene.elements)?.id ?? null;
      const pct = runtime.challengeFor(sceneId)?.required_pct ?? DEFAULT_REQUIRED_PCT;
      const bars = patchedBarSummaries.filter(
        (b) => ids.has(b.id) && b.id !== reservedId && b.id !== timeBar.elementId,
      );
      if (bars.length === 0) return false;
      return bars.every((b) => {
        const target = Math.max(1, Math.round((b.required * pct) / 100));
        return b.achieved >= target;
      });
    },
    [learningPoints, patchedBarSummaries, runtime, timeBar.elementId],
  );

  /** Required mark reached for the Learning Point currently on screen. */
  const challengeMet = useMemo(
    () => (activeScene ? pointSatisfied(activeScene.id) : false),
    [activeScene, pointSatisfied],
  );

  /**
   * The master Progress Bar of the moment — the single definition every team
   * competes on. Video Adventure: the Learning Point's own learning bar.
   */
  const masterBar = useMemo<MasterBar | null>(() => {
    const reservedId = stageScene ? timeBarOf(stageScene.elements)?.id ?? null : null;
    const pool = isVideo && stageScene
      ? patchedBarSummaries.filter((b) => (stageScene.elements ?? []).some((e) => e.id === b.id))
      : patchedBarSummaries;
    const bar = pool.find((b) => b.id !== reservedId && b.id !== timeBar.elementId) ?? null;
    if (!bar) return null;
    return {
      id: bar.id,
      label: bar.label,
      assessmentId: bar.assessmentId,
      total: bar.total,
      goalPct: bar.goalPct,
      segments: bar.segments,
    };
  }, [isVideo, stageScene, patchedBarSummaries, timeBar.elementId]);

  const requiredPct = isVideo
    ? runtime.challengeFor(stageScene?.id)?.required_pct ?? DEFAULT_REQUIRED_PCT
    : 100;

  const standings = useMemo(
    () =>
      computeGroupStandings({
        groups: groups.groups,
        studentsByGroup: groups.studentsByGroup,
        master: masterBar,
        scores: sync.scoresByAssessment,
        requiredPct,
        mode: isVideo ? "video" : "static",
        winnerGroupId: null,
      }),
    [groups.groups, groups.studentsByGroup, masterBar, sync.scoresByAssessment, requiredPct, isVideo],
  );
  const fillByGroup = useMemo(() => fillByGroupOf(standings), [standings]);

  // The dashboard is the single writer of competition outcomes. In a Video
  // Adventure the verdict is taken when the Learning Point's own clock expires.
  const outcome = useGroupOutcome({
    classId,
    gameId,
    mode: isVideo ? "video" : "static",
    sceneId: isVideo ? runtime.activeChallenge?.scene_id ?? null : canvas?.activeSceneId ?? null,
    groups: groupMode ? groups.groups : [],
    fillByGroup,
    timeExpired: isVideo ? runtime.expired : timeBar.expired,
    authoritative: true,
    runKey: runtime.run?.started_at ?? null,
    onChanged: groups.refresh,
  });

  /** Standings shown on the board, including the decided race winner. */
  const boardStandings = useMemo(
    () =>
      computeGroupStandings({
        groups: groups.groups,
        studentsByGroup: groups.studentsByGroup,
        master: masterBar,
        scores: sync.scoresByAssessment,
        requiredPct,
        mode: isVideo ? "video" : "static",
        winnerGroupId: outcome.winner?.id ?? null,
      }),
    [groups.groups, groups.studentsByGroup, masterBar, sync.scoresByAssessment, requiredPct, isVideo, outcome.winner],
  );



  /**
   * A challenge ends when its timer runs out. Without groups it may also end
   * early on the required mark; in Group Mode the full time always runs so a
   * group that fills its bar early simply waits and the competition is judged
   * for everyone at zero.
   */
  useEffect(() => {
    const ch = runtime.activeChallenge;
    if (!isVideo || !ch) return;
    const early = challengeMet && !groupMode;
    if (!early && !runtime.expired) return;
    setExitingSceneId(ch.scene_id);
    void runtime.actions.endChallenge(ch.scene_id, challengeMet ? "completed" : "expired");
  }, [isVideo, groupMode, runtime.activeChallenge, runtime.expired, challengeMet, runtime.actions]);

  // Sound: the teacher's dashboard is the live game screen, so it plays the
  // adventure's ambience, the active Learning Point's music and its narration.
  const narrations = useMemo(() => narrationsOf(canvas), [canvas]);
  const narrationRuntime = useNarrationPlayback(
    narrations,
    isVideo && runtime.started,
    runtime.run?.started_at ?? "idle",
  );
  const gameAudio = useAdventureAudio(canvas, stageScene?.id ?? null, runtime.started);

  const stageAudioRef = useRef<string | null>(null);
  useEffect(() => {
    const id = activeScene?.id ?? null;
    if (!runtime.started) { stageAudioRef.current = null; return; }
    if (!id || stageAudioRef.current === id) return;
    stageAudioRef.current = id;
    narrationRuntime.onLoopStart(activeScene);
    gameAudio.effect("loop_start");
  }, [runtime.started, activeScene, narrationRuntime, gameAudio]);

  const onVideoTime = useCallback(
    (t: number) => {
      if (!isVideo) return;
      setGameTime(t);
      // Publish the master playhead about once a second — students follow it.
      const nowMs = Date.now();
      if (nowMs - lastPublishRef.current > 900) {
        lastPublishRef.current = nowMs;
        void runtime.actions.publish({ playhead: t });
      }
      narrationRuntime.onTime(t);
      // A restart is winding the video back to 0:00 — open nothing yet.
      if (restarting) {
        if (t <= 0.4) setRestarting(false);
        return;
      }
      // A finished Learning Point plays out its own lap, then hands back.
      if (exitingSceneId) {
        const end = exitingScene?.loopEnd ?? 0;
        if (t >= end - 0.05) setExitingSceneId(null);
        return;
      }
      if (runtime.activeChallenge) return;
      const hit = checkpointAt(learningPoints, t);
      // No cached completion: a point only stays shut while it is still
      // satisfied by the CURRENT class, scores and required mark.
      if (!hit || pointSatisfied(hit.id)) return;
      const bar = timeBarOf(hit.elements);
      void runtime.actions.openChallenge(hit.id, {
        progressElementId: bar?.id ?? null,
        durationSeconds: sceneTimeSeconds(hit) || DEFAULT_LP_DURATION_SECONDS,
        requiredPct: DEFAULT_REQUIRED_PCT,
      });
    },
    [
      isVideo,
      runtime.actions,
      runtime.activeChallenge,
      exitingSceneId,
      exitingScene,
      learningPoints,
      pointSatisfied,
      narrationRuntime,
      restarting,
    ],
  );

  /**
   * Restart Game replays the story from Game Time 00:00: the video rewinds to
   * the very beginning (never to the current loop), the teacher timeline resets
   * and every loop state and Loop Time clock is cleared. It never writes to
   * student progress, gallery or award tables — marks and scores carry over.
   */
  const startGame = useCallback(() => {
    if (runtime.started && !window.confirm("Restart the story from the beginning? Student progress and scores are kept.")) {
      return;
    }
    unlockAudio();
    setExitingSceneId(null);
    // Release the loop region first, otherwise the active loop snaps the
    // playhead straight back to its own start.
    setRestarting(true);
    setGameTime(0);
    void runtime.actions
      .startGame()
      .then(() => {
        videoRef.current?.seek(0);
        videoRef.current?.play();
        timeBar.refresh();
        groups.refresh();
      })
      .catch(() => setRestarting(false));
  }, [runtime.actions, runtime.started, timeBar.refresh, groups.refresh]);


  // The video sits on its first frame until Start Game is pressed.
  useEffect(() => {
    if (!isVideo || runtime.started) return;
    videoRef.current?.seek(0);
    videoRef.current?.pause();
  }, [isVideo, runtime.started]);

  /**
   * Objects on screen during a Video Adventure: only the Learning Point that is
   * active (or finishing its lap). Outside a Learning Point the canvas is clean.
   */
  const videoElements = useMemo(() => {
    if (!stageScene) return [];
    const ids = new Set((stageScene.elements ?? []).map((e) => e.id));
    const timeBarId = timeBarOf(stageScene.elements)?.id ?? null;
    const ch = runtime.activeChallenge;
    return canvasElements
      .filter((el) => ids.has(el.id))
      // Completed: the bars disappear at once, the reward finishes travelling.
      .filter((el) => !(exitingSceneId && el.kind === "progress_bar"))
      .map((el) => {
        if (!ch || !timeBarId || el.id !== timeBarId || el.kind !== "progress_bar" || !el.progress) return el;
        const segs = Math.max(1, Number(el.progress.segments) || 10);
        const total = Math.max(1, ch.duration_seconds * 1000);
        const lit = Math.round((runtime.remainingMs / total) * segs);
        return { ...el, progress: { ...el.progress, currentMarks: lit, totalMarks: segs } };
      });
  }, [stageScene, canvasElements, exitingSceneId, runtime.activeChallenge, runtime.remainingMs]);

  /**
   * Group Competition — one duplicate of the master bar per team, purely as a
   * visual scoreboard on the teacher's stage. Every duplicate carries the same
   * questions and rules; only its fill differs, because it shows that team's own
   * live progress. Teachers may drag and resize them freely.
   */
  const teamBarElements = useMemo(() => {
    if (!groupMode || !masterBar) return [];
    const master = canvasElements.find((el) => el.id === masterBar.id) ?? null;
    return buildGroupScoreboardBars(
      master,
      boardStandings.map((s) => ({ group: s.group, fill: fillByGroup.get(s.group.id) ?? 0 })),
    );
  }, [groupMode, masterBar, canvasElements, boardStandings, fillByGroup]);

  /** Persist a dragged team bar so its place on the stage is remembered. */
  const onStageMove = useCallback(
    (id: string, x: number, y: number) => {
      const groupId = groupIdOfBarElementId(id);
      if (!groupId) return;
      void moveGroupBar(groupId, x, y).then(() => groups.refresh()).catch(() => {});
    },
    [groups.refresh],
  );

  const videoStageElements = useMemo(
    () => (runtime.activeChallenge && !exitingSceneId ? [...videoElements, ...teamBarElements] : videoElements),
    [videoElements, teamBarElements, runtime.activeChallenge, exitingSceneId],
  );

  const staticStageElements = useMemo(
    () => [...canvasElements, ...teamBarElements],
    [canvasElements, teamBarElements],
  );


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
          {patchedBarSummaries.length > 0 && (!isVideo || Boolean(runtime.activeChallenge)) && (
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


          {gameId && isVideo && (
            <div className="mx-auto mb-3 flex w-full max-w-[1500px] flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={startGame}
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/15 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/25"
              >
                <Play className="h-4 w-4" /> {runtime.started ? "Restart Game" : "Start Game"}
              </button>
              {!runtime.started && (
                <span className="text-xs text-muted-foreground">
                  The adventure is waiting at 0:00. Students cannot open questions until you start.
                </span>
              )}
              {groupMode && teamBarElements.length > 0 && (
                <button
                  type="button"
                  onClick={() => setArrangeTeamBars((v) => !v)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                    arrangeTeamBars
                      ? "border-primary/60 bg-primary/20 text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {arrangeTeamBars ? "Done arranging" : "Arrange team bars"}
                </button>
              )}
              <div className="w-full">
                <LearningPointTimeBars
                  learningPoints={learningPoints}
                  challengeFor={runtime.challengeFor}
                  activeChallenge={runtime.activeChallenge}
                  remainingMs={runtime.remainingMs}
                  onSetDuration={(sceneId, seconds) => void runtime.actions.setDuration(sceneId, seconds)}
                  onSetRequiredPct={(sceneId, pct) => void runtime.actions.setRequiredPct(sceneId, pct)}
                />
              </div>
            </div>
          )}
          {gameId && !isVideo && (
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
                {isVideo && canvas?.video && (
                  <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "16 / 9" }}>
                    <VideoBackgroundLayer
                      ref={videoRef}
                      video={canvas.video}
                      playing={runtime.started}
                      loop={restarting ? null : loopRegionFor(activeScene, false)}
                      onTime={onVideoTime}
                      onLoaded={({ duration }) => setVideoDuration(duration)}
                    />
                    <div className={arrangeTeamBars ? "absolute inset-0" : "pointer-events-none absolute inset-0"}>
                      <GameCanvas
                        elements={videoStageElements}
                        selectedId={null}
                        editable={arrangeTeamBars}
                        onMove={arrangeTeamBars ? onStageMove : undefined}
                        fill
                        transparent
                      />
                    </div>
                    {activeScene && (
                      <div className="absolute left-3 top-3 z-40 rounded-full border border-primary/40 bg-background/80 px-3 py-1 text-xs font-semibold text-primary backdrop-blur">
                        {activeScene.title || "Learning Point"}
                      </div>
                    )}
                    {/* Game Time is the story clock; Loop Time is the Learning Point countdown. */}
                    <div className="absolute right-3 top-3 z-40 flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[11px] font-semibold tabular-nums backdrop-blur">
                      <span className="text-muted-foreground">Game Time</span>
                      <span>{fmtClock(gameTime)}{videoDuration ? ` / ${fmtClock(videoDuration)}` : ""}</span>
                      {runtime.activeChallenge && (
                        <>
                          <span className="text-muted-foreground">· Loop Time</span>
                          <span className="text-primary">{fmtClock(runtime.remainingMs / 1000)}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
                {!isVideo && (
                <GameCanvas
                  elements={staticStageElements}
                  selectedId={selectedRewardId}
                  editable
                  onSelect={(id) => {
                    if (!id) { setSelectedRewardId(null); return; }
                    const el = canvasElements.find((e) => e.id === id);
                    setSelectedRewardId(el?.kind === "reward" ? id : null);
                  }}
                  onMove={onStageMove}

                  heightUnits={sync.heightUnits}
                />
                )}
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
                {classId && gameId && groupMode && (
                  <div className="mt-6 border-t border-border pt-4">
                    <GroupLeaderboard
                      standings={boardStandings}
                      masterLabel={masterBar?.label ?? null}
                      winnerName={outcome.winner?.name ?? null}
                    />
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Teams are created and edited on the Adventure page under Game Mode.
                    </p>
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
