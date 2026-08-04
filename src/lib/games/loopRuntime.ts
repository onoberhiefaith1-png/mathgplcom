// Learning Point runtime — the single state machine behind Preview and live
// gameplay.
//
// A Learning Point (Loop) is a room inside the background video. It owns every
// object placed in it and moves through four states:
//
//   upcoming → active → completed → hidden
//
// Completion never moves the video. It flips one boolean; the loop simply stops
// wrapping and plays out to its own Loop End, after which its objects unmount
// and playback travels on naturally.

import { useCallback, useMemo, useRef, useState } from "react";
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
 * Objects that exist on screen right now: only the active (or exiting) loop's.
 * During the exit lap every progress bar in the loop reads as fully charged.
 */
export const visibleLoopElements = (
  all: CanvasElement[],
  loop: Scene | null,
  opts: { full?: boolean } = {},
): CanvasElement[] => {
  if (!loop) return [];
  const mine = new Set((loop.elements ?? []).map((e) => e.id));
  return all
    .filter((e) => mine.has(e.id))
    .map((e) => {
      if (!opts.full || e.kind !== "progress_bar" || !e.progress) return e;
      const total = e.progress.totalMarks > 0 ? e.progress.totalMarks : 1;
      return { ...e, progress: { ...e.progress, totalMarks: total, currentMarks: total } };
    });
};

export interface LoopRuntime {
  active: boolean;
  playing: boolean;
  /** Loop the runtime is currently sitting inside (or finishing). */
  activeLoopId: string | null;
  /** Loop playing out its final lap after completion. */
  exitingLoopId: string | null;
  /** Loops already left behind. */
  clearedLoopIds: Set<string>;
  /** True once the final Learning Point has been completed. */
  ended: boolean;
  stateOf: (loopId: string) => LoopState;
  /** Loop region to hand the video layer (null = travel normally). */
  loopRegion: { start: number; end: number } | null;
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

  const loopsRef = useRef(loops);
  loopsRef.current = loops;
  const activeRef = useRef(activeLoopId);
  activeRef.current = activeLoopId;
  const exitingRef = useRef(exitingLoopId);
  exitingRef.current = exitingLoopId;
  const clearedRef = useRef(clearedLoopIds);
  clearedRef.current = clearedLoopIds;

  const activeLoop = useMemo(
    () => loops.find((l) => l.id === activeLoopId) ?? null,
    [loops, activeLoopId],
  );

  const start = useCallback(() => {
    setActive(true);
    setPlaying(true);
    setActiveLoopId(null);
    setExitingLoopId(null);
    setClearedLoopIds(new Set());
    setEnded(false);
    seek(0);
  }, [seek]);

  const stop = useCallback(() => {
    setActive(false);
    setPlaying(false);
    setActiveLoopId(null);
    setExitingLoopId(null);
    setClearedLoopIds(new Set());
    setEnded(false);
  }, []);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);

  /** Completion: `completed = true`, nothing else. No seek, no jump. */
  const complete = useCallback(() => {
    const id = activeRef.current;
    if (!id || exitingRef.current) return;
    const list = loopsRef.current;
    const isFinal = list.length > 0 && list[list.length - 1]?.id === id;
    if (isFinal) {
      setEnded(true);
      setPlaying(false);
      return;
    }
    setExitingLoopId(id);
  }, []);

  const onTime = useCallback((t: number) => {
    const list = loopsRef.current;
    const exiting = exitingRef.current;
    if (exiting) {
      const loop = list.find((l) => l.id === exiting);
      const end = loop?.loopEnd ?? 0;
      if (t >= end - 0.05) {
        setClearedLoopIds((prev) => new Set(prev).add(exiting));
        setExitingLoopId(null);
        setActiveLoopId(null);
      }
      return;
    }
    if (activeRef.current) return;
    const hit = checkpointAt(list, t);
    if (hit && !clearedRef.current.has(hit.id)) setActiveLoopId(hit.id);
  }, []);

  const loopRegion = useMemo(
    () => (active ? loopRegionFor(activeLoop, Boolean(exitingLoopId)) : null),
    [active, activeLoop, exitingLoopId],
  );

  const stateOf = useCallback(
    (loopId: string) =>
      loopStateOf(loopId, { activeId: activeLoopId, exitingId: exitingLoopId, completedIds: clearedLoopIds }),
    [activeLoopId, exitingLoopId, clearedLoopIds],
  );

  const visibleElements = useCallback(
    (all: CanvasElement[]) => {
      if (!active) return all;
      return visibleLoopElements(all, activeLoop, { full: Boolean(exitingLoopId) });
    },
    [active, activeLoop, exitingLoopId],
  );

  return {
    active,
    playing,
    activeLoopId,
    exitingLoopId,
    clearedLoopIds,
    ended,
    stateOf,
    loopRegion,
    visibleElements,
    start,
    stop,
    play,
    pause,
    complete,
    next: complete,
    onTime,
  };
};

/** Display name for a progress bar element (teacher-set, else generic). */
export const barName = (el: { label?: string } | null | undefined): string =>
  (el?.label ?? "").trim() || "Progress Bar";
