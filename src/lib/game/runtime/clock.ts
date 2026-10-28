// ONE canonical game clock.
//
// Every Game timer (question time, line time, reward timers, HUD countdown)
// subscribes here instead of creating its own interval. The underlying timing
// stays accurate because every subscriber compares against Date.now(); only the
// notification rate is shared.

type Listener = (now: number) => void;

const listeners = new Set<Listener>();
let handle: number | null = null;

/** Display rate: fast enough for a smooth countdown, slow enough to be free. */
const TICK_MS = 250;

const pump = () => {
  const now = Date.now();
  // A copy, so a listener that unsubscribes during the pump is safe.
  for (const listener of Array.from(listeners)) {
    try {
      listener(now);
    } catch (error) {
      console.error("[game-clock]", error);
    }
  }
};

const ensureRunning = () => {
  if (handle !== null || listeners.size === 0) return;
  handle = window.setInterval(pump, TICK_MS);
};

const stopIfIdle = () => {
  if (handle === null || listeners.size > 0) return;
  window.clearInterval(handle);
  handle = null;
};

/** Subscribe to the one clock. Returns the unsubscribe function. */
export function subscribeGameClock(listener: Listener): () => void {
  listeners.add(listener);
  ensureRunning();
  return () => {
    listeners.delete(listener);
    stopIfIdle();
  };
}

/** Seconds remaining until a deadline, never negative. */
export const secondsUntil = (deadline: number | null, now = Date.now()) =>
  deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;

/** Test helper: how many subscribers the single clock currently drives. */
export const gameClockListenerCount = () => listeners.size;
