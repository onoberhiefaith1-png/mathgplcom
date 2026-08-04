// Video Adventure Preview runtime — a director's run-through.
//
// The video plays normally, stops at each Learning Point (loop) and loops there
// forever until the teacher presses "Next Learning Point". Pressing it
// simulates a completed checkpoint: the loop's progress bars snap to full, the
// reward exits, and the loop is allowed to finish naturally before playback
// travels on. Only the final Learning Point ends the adventure.

import { useCallback, useMemo, useRef, useState } from "react";
import { checkpointAt, type CanvasElement, type Scene } from "./types";

export interface PreviewRuntime {
  active: boolean;
  playing: boolean;
  /** Loop the preview is currently sitting inside (or finishing). */
  activeLoopId: string | null;
  /** Loop that is playing out its final seconds after "Next". */
  exitingLoopId: string | null;
  clearedLoopIds: Set<string>;
  /** True once the final Learning Point has been completed. */
  ended: boolean;
  /** Loop region to hand the video layer (null = travel normally). */
  loopRegion: { start: number; end: number } | null;
  /** Elements that exist on screen right now. */
  visibleElements: (all: CanvasElement[]) => CanvasElement[];
  start: () => void;
  stop: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  onTime: (t: number) => void;
}

export const usePreviewRuntime = (loops: Scene[], seek: (t: number) => void): PreviewRuntime => {
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

  /** Simulate the student completing the current Learning Point. */
  const next = useCallback(() => {
    const id = activeRef.current;
    if (!id || exitingRef.current) return;
    const list = loopsRef.current;
    const isFinal = list.length > 0 && list[list.length - 1]?.id === id;
    if (isFinal) {
      setEnded(true);
      setPlaying(false);
      return;
    }
    // The loop keeps running to its end — no jump. The exit happens on the tick
    // that reaches loopEnd.
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

  const loopRegion = useMemo(() => {
    if (!active || !activeLoop || exitingLoopId) return null;
    if (activeLoop.loopEnd == null) return null;
    return { start: activeLoop.loopStart ?? 0, end: activeLoop.loopEnd };
  }, [active, activeLoop, exitingLoopId]);

  const visibleElements = useCallback(
    (all: CanvasElement[]) => {
      if (!active) return all;
      if (!activeLoop) return [];
      const mine = new Set((activeLoop.elements ?? []).map((e) => e.id));
      const full = Boolean(exitingLoopId);
      return all
        .filter((e) => mine.has(e.id))
        .map((e) => {
          if (!full || e.kind !== "progress_bar" || !e.progress) return e;
          const total = e.progress.totalMarks > 0 ? e.progress.totalMarks : 1;
          return { ...e, progress: { ...e.progress, totalMarks: total, currentMarks: total } };
        });
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
    loopRegion,
    visibleElements,
    start,
    stop,
    play,
    pause,
    next,
    onTime,
  };
};

/** Display name for a progress bar element (teacher-set, else generic). */
export const barName = (el: { label?: string } | null | undefined): string =>
  (el?.label ?? "").trim() || "Progress Bar";
