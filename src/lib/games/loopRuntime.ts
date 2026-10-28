// Learning Point runtime — the single state machine behind Preview and live
// gameplay.
//
// A Learning Point (Loop) is a room inside the background video. It owns every
// object placed in it and moves through four states:
//
//   upcoming → active → completed → hidden
//
// Design law: a Learning Point is NEVER completed because the playhead reached
// Loop End. It loops forever — even when it is the last thing in the video —
// until the teacher presses Next (Preview) or a Progress Bar reaches 100%
// (gameplay). Completion never moves the playhead: it flips one boolean, the
// loop stops wrapping, and the video plays out to its own Loop End before the
// objects unmount and the journey travels on.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { checkpointAt, type CanvasElement, type Scene } from "./types";

/** The four Learning Point states. */
export type LoopState = "upcoming" | "active" | "completed" | "hidden";

/** Pure state resolver shared by every runtime surface. */
export const loopStateOf = (
  loopId: string,
  opts: { activeId: string | null; exitingId: string | null; completedIds: Set<string> },
): LoopState => {
  if (loopId === opts.exitingId) return "completed";
  if (loopId === opts.activeId) return "active";
  if (opts.completedIds.has(loopId)) return "hidden";
  return "upcoming";
};

/**
 * The loop region the video layer should honour. `null` means "travel
 * normally" — which is exactly what a completed loop returns, so it finishes
 * its final lap without wrapping.
 */
export const loopRegionFor = (
  loop: Scene | null | undefined,
  completed: boolean,
): { start: number; end: number } | null => {
  if (!loop || completed) return null;
  if (loop.loopEnd == null) return null;
  return { start: loop.loopStart ?? 0, end: loop.loopEnd };
};

/**
 * Reward exit animation, timed automatically:
 *
 *   duration = Loop End − playhead at completion
 *
 * so the reward always arrives exactly as the video leaves the Learning Point.
 */
export const rewardExitOffset = (progress: number): { dy: number; opacity: number } => {
  const k = Math.min(1, Math.max(0, progress));
  return { dy: -1.4 * (k * k), opacity: Math.max(0, 1 - k * k) };
};

/**
 * Objects that exist on screen right now: only the active (or exiting) loop's.
 * During the exit lap the Progress Bars are gone immediately and the reward
 * travels upward over the remaining loop time.
 */
export const visibleLoopElements = (
  all: CanvasElement[],
  loop: Scene | null,
  opts: { exiting?: boolean; exitProgress?: number } = {},
): CanvasElement[] => {
  if (!loop) return [];
  const mine = new Set((loop.elements ?? []).map((e) => e.id));
  const out: CanvasElement[] = [];
  for (const e of all) {
    if (!mine.has(e.id)) continue;
    if (!opts.exiting) { out.push(e); continue; }
    // Completed: the Progress Bar is no longer needed and disappears at once.
    if (e.kind === "progress_bar") continue;
    if (e.kind === "reward") {
      const off = rewardExitOffset(opts.exitProgress ?? 0);
      out.push({ ...e, y: e.y + off.dy, opacity: off.opacity });
      continue;
    }
    out.push(e);
  }
  return out;
};

export interface LoopRuntime {
  active: boolean;
  playing: boolean;
  /** Increments on every `start()` — a brand-new run (resets narration etc.). */
  runId: number;
  /** Real elapsed seconds of this run. Never rewinds when the video loops. */
  elapsed: number;

  /** Loop the runtime is currently sitting inside (or finishing). */
  activeLoopId: string | null;
  /** Loop playing out its final lap after completion. */
  exitingLoopId: string | null;
  /** Loops already left behind. */
  clearedLoopIds: Set<string>;
  /** True once the final Learning Point has been completed and left. */
  ended: boolean;
  stateOf: (loopId: string) => LoopState;
  /** Loop region to hand the video layer (null = travel normally). */
  loopRegion: { start: number; end: number } | null;
  /** Playhead position when the active loop was completed. */
  completedAt: number | null;
  /** Seconds the reward has to finish its upward travel (Loop End − completedAt). */
  exitDuration: number;
  /** 0 → 1 across the exit lap. */
  exitProgress: number;
  /** True from the moment of completion: bars are hidden immediately. */
  barsHidden: boolean;
  visibleElements: (all: CanvasElement[]) => CanvasElement[];
  start: () => void;
  stop: () => void;
  play: () => void;
  pause: () => void;
  /** Mark the active loop completed — the one mutation that drives everything. */
  complete: () => void;
  /** @deprecated alias of `complete` kept for existing call sites. */
  next: () => void;
  onTime: (t: number) => void;
  /** The video reached its end — ignored while an incomplete loop is active. */
  videoEnded: () => void;
}

/**
 * Manual-completion runtime used by the editor Preview. Gameplay uses the same
 * pure helpers above with completion driven by a filled progress bar.
 */
export const useLoopRuntime = (loops: Scene[], seek: (t: number) => void): LoopRuntime => {
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [activeLoopId, setActiveLoopId] = useState<string | null>(null);
  const [exitingLoopId, setExitingLoopId] = useState<string | null>(null);
  const [clearedLoopIds, setClearedLoopIds] = useState<Set<string>>(() => new Set());
  const [ended, setEnded] = useState(false);
  const [completedAt, setCompletedAt] = useState<number | null>(null);
  const [exitDuration, setExitDuration] = useState(0);
  const [time, setTime] = useState(0);
  /** Bumped on every start() so downstream runtimes know this is a fresh run. */
  const [runId, setRunId] = useState(0);
  /** Real elapsed time of the run — independent of the looping video clock. */
  const [elapsed, setElapsed] = useState(0);


  const loopsRef = useRef(loops);
  loopsRef.current = loops;
  const activeRef = useRef(activeLoopId);
  activeRef.current = activeLoopId;
  const exitingRef = useRef(exitingLoopId);
  exitingRef.current = exitingLoopId;
  const clearedRef = useRef(clearedLoopIds);
  clearedRef.current = clearedLoopIds;
  const timeRef = useRef(0);
  /** The exiting loop is the final one — the adventure ends when its lap ends. */
  const finalExitRef = useRef(false);

  const activeLoop = useMemo(
    () => loops.find((l) => l.id === activeLoopId) ?? null,
    [loops, activeLoopId],
  );

  const finishExit = useCallback((id: string) => {
    setClearedLoopIds((prev) => new Set(prev).add(id));
    setExitingLoopId(null);
    setActiveLoopId(null);
    setCompletedAt(null);
    setExitDuration(0);
    if (finalExitRef.current) {
      finalExitRef.current = false;
      setEnded(true);
      setPlaying(false);
    }
  }, []);

  const start = useCallback(() => {
    setActive(true);
    setPlaying(true);
    setExitingLoopId(null);
    setClearedLoopIds(new Set());
    setEnded(false);
    setCompletedAt(null);
    setExitDuration(0);
    finalExitRef.current = false;
    timeRef.current = 0;
    setTime(0);
    // A run is entirely disposable: new id, clean clock.
    setRunId((n) => n + 1);
    setElapsed(0);
    // Edge case: the adventure may begin inside Learning Point 1 (no
    // introduction) — enter it on the very first frame.
    const first = checkpointAt(loopsRef.current, 0);
    setActiveLoopId(first?.id ?? null);
    seek(0);
  }, [seek]);

  const stop = useCallback(() => {
    setActive(false);
    setPlaying(false);
    setActiveLoopId(null);
    setExitingLoopId(null);
    setClearedLoopIds(new Set());
    setEnded(false);
    setCompletedAt(null);
    setExitDuration(0);
    setElapsed(0);
    finalExitRef.current = false;
  }, []);

  // Game Timer: real seconds, counting only while the run is playing. It never
  // rewinds when the video wraps back to a Loop Start.
  useEffect(() => {
    if (!active || !playing) return;
    const id = window.setInterval(() => setElapsed((e) => e + 0.25), 250);
    return () => window.clearInterval(id);
  }, [active, playing]);


  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);

  /** Completion: `completed = true`, nothing else. No seek, no jump. */
  const complete = useCallback(() => {
    const id = activeRef.current;
    if (!id || exitingRef.current) return;
    const list = loopsRef.current;
    const loop = list.find((l) => l.id === id) ?? null;
    const end = loop?.loopEnd ?? timeRef.current;
    const at = timeRef.current;
    finalExitRef.current = list.length > 0 && list[list.length - 1]?.id === id;
    setCompletedAt(at);
    setExitDuration(Math.max(0, end - at));
    setExitingLoopId(id);
    // Already at (or past) Loop End: nothing left to animate.
    if (end - at <= 0.05) finishExit(id);
  }, [finishExit]);

  const onTime = useCallback(
    (t: number) => {
      timeRef.current = t;
      setTime(t);
      const list = loopsRef.current;
      const exiting = exitingRef.current;
      if (exiting) {
        const loop = list.find((l) => l.id === exiting);
        const end = loop?.loopEnd ?? 0;
        if (t >= end - 0.05) finishExit(exiting);
        return;
      }
      // An active, incomplete Learning Point keeps looping — even at the very
      // end of the video. Nothing here can complete it.
      if (activeRef.current) return;
      const hit = checkpointAt(list, t);
      if (hit && !clearedRef.current.has(hit.id)) setActiveLoopId(hit.id);
    },
    [finishExit],
  );

  /**
   * Reaching the end of the video is not completing the adventure. While an
   * incomplete Learning Point is active the loop simply wraps again.
   */
  const videoEnded = useCallback(() => {
    const exiting = exitingRef.current;
    if (exiting) { finishExit(exiting); return; }
    if (activeRef.current) return;
    setEnded(true);
    setPlaying(false);
  }, [finishExit]);

  const loopRegion = useMemo(
    () => (active ? loopRegionFor(activeLoop, Boolean(exitingLoopId)) : null),
    [active, activeLoop, exitingLoopId],
  );

  const exitProgress = useMemo(() => {
    if (!exitingLoopId || completedAt == null) return 0;
    if (exitDuration <= 0) return 1;
    return Math.min(1, Math.max(0, (time - completedAt) / exitDuration));
  }, [exitingLoopId, completedAt, exitDuration, time]);

  const stateOf = useCallback(
    (loopId: string) =>
      loopStateOf(loopId, { activeId: activeLoopId, exitingId: exitingLoopId, completedIds: clearedLoopIds }),
    [activeLoopId, exitingLoopId, clearedLoopIds],
  );

  const visibleElements = useCallback(
    (all: CanvasElement[]) => {
      if (!active) return all;
      return visibleLoopElements(all, activeLoop, {
        exiting: Boolean(exitingLoopId),
        exitProgress,
      });
    },
    [active, activeLoop, exitingLoopId, exitProgress],
  );

  return {
    active,
    playing,
    runId,
    elapsed,

    activeLoopId,
    exitingLoopId,
    clearedLoopIds,
    ended,
    stateOf,
    loopRegion,
    completedAt,
    exitDuration,
    exitProgress,
    barsHidden: Boolean(exitingLoopId),
    visibleElements,
    start,
    stop,
    play,
    pause,
    complete,
    next: complete,
    onTime,
    videoEnded,
  };
};

/** Display name for a progress bar element (teacher-set, else generic). */
export const barName = (el: { label?: string } | null | undefined): string =>
  (el?.label ?? "").trim() || "Progress Bar";
