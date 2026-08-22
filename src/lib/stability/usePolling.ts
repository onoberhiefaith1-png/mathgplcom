/**
 * One safe way to poll.
 *
 * - registers itself so a leak is measurable
 * - never overlaps: a slow tick can't stack up behind itself
 * - pauses while the tab is hidden and catches up on return
 * - always clears on unmount
 */
import { useEffect, useRef } from "react";
import { releaseResource, trackResource } from "./registry";

export function usePolling(
  label: string,
  task: () => void | Promise<unknown>,
  intervalMs: number,
  options: { enabled?: boolean; immediate?: boolean; pauseWhenHidden?: boolean } = {},
): void {
  const { enabled = true, immediate = true, pauseWhenHidden = true } = options;
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    let cancelled = false;
    let running = false;
    let timer: number | undefined;
    const resourceId = trackResource("interval", label);

    const run = async () => {
      if (cancelled || running) return;
      if (pauseWhenHidden && typeof document !== "undefined" && document.hidden) return;
      running = true;
      try {
        await taskRef.current();
      } catch (error) {
        console.warn(`[poll:${label}] tick failed`, error);
      } finally {
        running = false;
      }
    };

    const start = () => {
      if (timer !== undefined) return;
      timer = window.setInterval(() => void run(), intervalMs);
    };
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
        return;
      }
      void run();
      start();
    };

    if (immediate) void run();
    if (!(pauseWhenHidden && typeof document !== "undefined" && document.hidden)) start();
    if (pauseWhenHidden) document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      stop();
      if (pauseWhenHidden) document.removeEventListener("visibilitychange", onVisibility);
      releaseResource(resourceId);
    };
  }, [enabled, intervalMs, label, immediate, pauseWhenHidden]);
}
