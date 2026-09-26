import { useEffect, useState } from "react";

/**
 * Game boot phases. The board must be VISIBLE and TAPPABLE before any optional
 * layer loads, so the heavy work is admitted in order:
 *
 *  1 critical  — writing surfaces, text, input, simple lights
 *  2 important — photographed environment lighting, reward art
 *  3 optional  — premium effects, audio warmup
 *
 * Nothing in a later phase may block input from an earlier one.
 */
export type BootPhase = 1 | 2 | 3;

const idle = (run: () => void, fallbackMs: number) => {
  const request = (window as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
    .requestIdleCallback;
  if (request) return request(run, { timeout: fallbackMs });
  return window.setTimeout(run, fallbackMs);
};

/**
 * Advances only once the board has actually painted a frame, so a slow machine
 * simply gets its later layers later — it never gets a blank board.
 */
export function useBootPhase(ready: boolean, resetKey: unknown): BootPhase {
  const [phase, setPhase] = useState<BootPhase>(1);
  useEffect(() => setPhase(1), [resetKey]);
  useEffect(() => {
    if (!ready || phase >= 3) return;
    let raf = 0;
    let handle = 0;
    raf = window.requestAnimationFrame(() => {
      handle = idle(() => setPhase((current) => (current < 3 ? ((current + 1) as BootPhase) : current)), phase === 1 ? 260 : 900);
    });
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(handle);
    };
  }, [ready, phase, resetKey]);
  return phase;
}
