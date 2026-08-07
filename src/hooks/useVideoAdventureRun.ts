// Video Adventure live run — the teacher's master clock plus per-Learning-Point
// challenges.
//
// Design law (Video Adventure only): the Game and the Time Bars are separate.
// `Start Game` writes `started_at` on the run row and the video becomes the
// master timeline for every student. A Time Bar belongs to ONE Learning Point
// and only exists while the video sits inside that point.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";

export const DEFAULT_LP_DURATION_SECONDS = 600;
export const DEFAULT_REQUIRED_PCT = 100;

export type ChallengeOutcome = "completed" | "expired";

export type VideoRunRow = {
  id: string;
  class_id: string;
  game_id: string;
  started_at: string | null;
  playhead_seconds: number;
  playing: boolean;
  active_scene_id: string | null;
  ended_at: string | null;
};

export type ChallengeRow = {
  id: string;
  class_id: string;
  game_id: string;
  scene_id: string;
  progress_element_id: string | null;
  duration_seconds: number;
  required_pct: number;
  started_at: string | null;
  paused_at: string | null;
  accumulated_paused_ms: number;
  ended_at: string | null;
  outcome: ChallengeOutcome | null;
};

const TABLE_RUNS = "video_adventure_runs" as never;
const TABLE_CHALLENGES = "video_adventure_challenges" as never;

const elapsedOf = (row: ChallengeRow | null): number => {
  if (!row?.started_at) return 0;
  const start = new Date(row.started_at).getTime();
  const end = row.paused_at ? new Date(row.paused_at).getTime() : Date.now();
  return Math.max(0, end - start - (Number(row.accumulated_paused_ms) || 0));
};

export interface UseVideoAdventureRun {
  loading: boolean;
  run: VideoRunRow | null;
  challenges: ChallengeRow[];
  /** True once the teacher has pressed Start Game. */
  started: boolean;
  /** The Learning Point the teacher's video is currently inside. */
  activeChallenge: ChallengeRow | null;
  challengeFor: (sceneId: string | null | undefined) => ChallengeRow | null;
  remainingMs: number;
  /**
   * Countdown left on ONE Learning Point, derived from the teacher's row. Both
   * the dashboard and every student device read the clock from here, so there is
   * only ever one timer in the game.
   */
  remainingMsFor: (sceneId: string | null | undefined) => number | null;
  expired: boolean;
  refresh: () => Promise<void>;

  actions: {
    startGame: () => Promise<void>;
    endGame: () => Promise<void>;
    publish: (patch: { playhead?: number; playing?: boolean; activeSceneId?: string | null }) => Promise<void>;
    openChallenge: (
      sceneId: string,
      opts?: { progressElementId?: string | null; durationSeconds?: number; requiredPct?: number },
    ) => Promise<void>;
    endChallenge: (sceneId: string, outcome: ChallengeOutcome) => Promise<void>;
    setDuration: (sceneId: string, seconds: number) => Promise<void>;
    setRequiredPct: (sceneId: string, pct: number) => Promise<void>;
  };
}

/**
 * @param canWrite true for the teacher (class owner). Students read only; the
 *        write paths are additionally blocked by row level security.
 */
export function useVideoAdventureRun(
  classId: string | null | undefined,
  gameId: string | null | undefined,
  canWrite: boolean,
): UseVideoAdventureRun {
  const [run, setRun] = useState<VideoRunRow | null>(null);
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(classId && gameId));
  const [, setNow] = useState<number>(() => Date.now());

  const refresh = useCallback(async () => {
    if (!classId || !gameId) { setRun(null); setChallenges([]); return; }
    const [{ data: r }, { data: c }] = await Promise.all([
      supabase.from(TABLE_RUNS).select("*").eq("class_id", classId).eq("game_id", gameId).maybeSingle(),
      supabase.from(TABLE_CHALLENGES).select("*").eq("class_id", classId).eq("game_id", gameId),
    ]);
    setRun((r as unknown as VideoRunRow | null) ?? null);
    setChallenges(((c ?? []) as unknown as ChallengeRow[]));
  }, [classId, gameId]);

  useEffect(() => {
    let cancelled = false;
    if (!classId || !gameId) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [classId, gameId, refresh]);

  // Live mirror. Students follow the teacher through these two tables.
  useEffect(() => {
    if (!classId || !gameId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`video-run-${gameId}-${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "video_adventure_runs", filter: `game_id=eq.${gameId}` },
          () => { void refresh(); },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "video_adventure_challenges", filter: `game_id=eq.${gameId}` },
          () => { void refresh(); },
        )
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [classId, gameId, refresh]);

  // Countdown tick for the active challenge.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);

  const ensureRun = useCallback(async (): Promise<VideoRunRow | null> => {
    if (!classId || !gameId || !canWrite) return run;
    if (run) return run;
    await supabase.from(TABLE_RUNS).insert({ class_id: classId, game_id: gameId } as never);
    const { data } = await supabase
      .from(TABLE_RUNS).select("*").eq("class_id", classId).eq("game_id", gameId).maybeSingle();
    const next = (data as unknown as VideoRunRow | null) ?? null;
    setRun(next);
    return next;
  }, [classId, gameId, canWrite, run]);

  const patchRun = useCallback(
    async (patch: Partial<VideoRunRow>) => {
      if (!classId || !gameId || !canWrite) return;
      const current = await ensureRun();
      if (!current) return;
      setRun({ ...current, ...patch } as VideoRunRow);
      await supabase.from(TABLE_RUNS).update(patch as never).eq("id", current.id);
    },
    [classId, gameId, canWrite, ensureRun],
  );

  const patchChallenge = useCallback(
    async (sceneId: string, patch: Partial<ChallengeRow>) => {
      if (!classId || !gameId || !canWrite) return;
      setChallenges((prev) => prev.map((c) => (c.scene_id === sceneId ? { ...c, ...patch } : c)));
      await supabase
        .from(TABLE_CHALLENGES)
        .update(patch as never)
        .eq("class_id", classId)
        .eq("game_id", gameId)
        .eq("scene_id", sceneId);
    },
    [classId, gameId, canWrite],
  );

  /**
   * Restart Game replays the STORY only.
   *
   * It resets the teacher's timeline (video to 00:00), clears every Learning
   * Point challenge row and stops the shared Time Bar row so no countdown
   * survives from the previous run. It deliberately writes NOTHING to
   * `game_progress`, `class_game_boards`, gallery or award tables — student
   * marks and scores are persistent across restarts.
   */
  const startGame = useCallback(async () => {
    if (!classId || !gameId || !canWrite) return;
    // A brand new run: every challenge from the previous run is cleared.
    await supabase.from(TABLE_CHALLENGES).delete().eq("class_id", classId).eq("game_id", gameId);
    setChallenges([]);
    // All loop timers back to a stopped, full state.
    await supabase
      .from("game_time_bars" as never)
      .update({ started_at: null, paused_at: null, accumulated_paused_ms: 0 } as never)
      .eq("game_id", gameId);
    // No group carries a verdict from the previous run into the replay.
    await resetGroupJudgements(classId, gameId);
    await patchRun({
      started_at: new Date().toISOString(),
      playing: true,
      playhead_seconds: 0,
      active_scene_id: null,
      ended_at: null,
    });
  }, [classId, gameId, canWrite, patchRun]);


  const endGame = useCallback(async () => {
    await patchRun({ playing: false, ended_at: new Date().toISOString() });
  }, [patchRun]);

  const publish = useCallback(
    async (patch: { playhead?: number; playing?: boolean; activeSceneId?: string | null }) => {
      const next: Partial<VideoRunRow> = {};
      if (patch.playhead != null) next.playhead_seconds = patch.playhead;
      if (patch.playing != null) next.playing = patch.playing;
      if (patch.activeSceneId !== undefined) next.active_scene_id = patch.activeSceneId;
      if (Object.keys(next).length === 0) return;
      await patchRun(next);
    },
    [patchRun],
  );

  const openChallenge = useCallback(
    async (
      sceneId: string,
      opts?: { progressElementId?: string | null; durationSeconds?: number; requiredPct?: number },
    ) => {
      if (!classId || !gameId || !canWrite) return;
      const existing = challenges.find((c) => c.scene_id === sceneId);
      if (existing) {
        if (existing.ended_at) return; // already played out
        if (!existing.started_at) await patchChallenge(sceneId, { started_at: new Date().toISOString() });
        await patchRun({ active_scene_id: sceneId });
        return;
      }
      const row = {
        class_id: classId,
        game_id: gameId,
        scene_id: sceneId,
        progress_element_id: opts?.progressElementId ?? null,
        duration_seconds: Math.max(1, Math.round(opts?.durationSeconds || DEFAULT_LP_DURATION_SECONDS)),
        required_pct: Math.min(100, Math.max(1, Math.round(opts?.requiredPct || DEFAULT_REQUIRED_PCT))),
        started_at: new Date().toISOString(),
      };
      await supabase.from(TABLE_CHALLENGES).insert(row as never);
      await refresh();
      await patchRun({ active_scene_id: sceneId });
    },
    [classId, gameId, canWrite, challenges, patchChallenge, patchRun, refresh],
  );

  const endChallenge = useCallback(
    async (sceneId: string, outcome: ChallengeOutcome) => {
      const existing = challenges.find((c) => c.scene_id === sceneId);
      if (!existing || existing.ended_at) return;
      await patchChallenge(sceneId, { ended_at: new Date().toISOString(), outcome });
      await patchRun({ active_scene_id: null });
    },
    [challenges, patchChallenge, patchRun],
  );

  const setDuration = useCallback(
    (sceneId: string, seconds: number) =>
      patchChallenge(sceneId, { duration_seconds: Math.max(1, Math.round(seconds)) }),
    [patchChallenge],
  );

  const setRequiredPct = useCallback(
    (sceneId: string, pct: number) =>
      patchChallenge(sceneId, { required_pct: Math.min(100, Math.max(1, Math.round(pct))) }),
    [patchChallenge],
  );

  const challengeFor = useCallback(
    (sceneId: string | null | undefined) =>
      (sceneId ? challenges.find((c) => c.scene_id === sceneId) ?? null : null),
    [challenges],
  );

  const activeChallenge = useMemo(() => {
    const id = run?.active_scene_id;
    if (!id) return null;
    const row = challenges.find((c) => c.scene_id === id) ?? null;
    return row && !row.ended_at ? row : null;
  }, [run?.active_scene_id, challenges]);

  const remainingMs = activeChallenge
    ? Math.max(0, activeChallenge.duration_seconds * 1000 - elapsedOf(activeChallenge))
    : 0;

  // Single source of truth for the clock of one Learning Point.
  const remainingMsFor = useCallback(
    (sceneId: string | null | undefined) => {
      if (!sceneId) return null;
      const row = challenges.find((c) => c.scene_id === sceneId) ?? null;
      if (!row || !row.started_at) return null;
      return Math.max(0, row.duration_seconds * 1000 - elapsedOf(row));
    },
    [challenges],
  );

  return {
    loading,
    run,
    challenges,
    started: Boolean(run?.started_at) && !run?.ended_at,
    activeChallenge,
    challengeFor,
    remainingMs,
    remainingMsFor,

    expired: Boolean(activeChallenge) && remainingMs <= 0,
    refresh,
    actions: {
      startGame,
      endGame,
      publish,
      openChallenge,
      endChallenge,
      setDuration,
      setRequiredPct,
    },
  };
}
