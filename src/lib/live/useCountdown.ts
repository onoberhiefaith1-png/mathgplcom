import { useEffect, useState } from "react";

/** Ticks every second and returns the milliseconds remaining until `target`. */
export const useCountdown = (target: string | null | undefined): number => {
  const targetMs = target ? new Date(target).getTime() : NaN;
  const [remaining, setRemaining] = useState(() =>
    Number.isNaN(targetMs) ? 0 : targetMs - Date.now(),
  );

  useEffect(() => {
    if (Number.isNaN(targetMs)) {
      setRemaining(0);
      return;
    }
    setRemaining(targetMs - Date.now());
    const id = window.setInterval(() => setRemaining(targetMs - Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [targetMs]);

  return remaining;
};

/** Re-renders once per second so schedule-derived state stays fresh. */
export const useNowTick = (intervalMs = 1000): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
};
