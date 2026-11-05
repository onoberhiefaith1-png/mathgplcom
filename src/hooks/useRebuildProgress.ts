import { useEffect, useRef, useState } from "react";
import { clampPercent, monotonic } from "@/lib/progress/rebuildProgress";

/**
 * Ticks a percentage while `active`. `compute(now)` returns the current target
 * (0–100); the shown value only ever rises. When the run ends it fills to 100%
 * for a moment, then clears, so the bar visibly completes instead of vanishing.
 * A cancelled or failed run (`succeeded: false`) just clears — no fake 100%.
 */
export function useRebuildProgress(
  active: boolean,
  compute: (now: number) => number,
  opts: { succeeded?: boolean; tickMs?: number } = {},
): number | null {
  const { succeeded = true, tickMs = 400 } = opts;
  const [percent, setPercent] = useState<number | null>(null);
  const computeRef = useRef(compute);
  computeRef.current = compute;
  const succeededRef = useRef(succeeded);
  succeededRef.current = succeeded;
  const wasActive = useRef(false);

  useEffect(() => {
    if (active) {
      wasActive.current = true;
      const tick = () => {
        let next = 0;
        try { next = clampPercent(computeRef.current(Date.now())); } catch { /* keep last */ }
        setPercent((prev) => monotonic(prev, Math.min(99, next)));
      };
      tick();
      const id = window.setInterval(tick, tickMs);
      return () => window.clearInterval(id);
    }
    if (!wasActive.current) return;
    wasActive.current = false;
    if (!succeededRef.current) { setPercent(null); return; }
    setPercent(100);
    const done = window.setTimeout(() => setPercent(null), 700);
    return () => window.clearTimeout(done);
  }, [active, tickMs]);

  return percent;
}
