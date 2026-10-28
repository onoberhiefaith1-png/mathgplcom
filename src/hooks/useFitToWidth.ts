import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Fit-to-width scale for a fixed-width child (e.g. the A4 lesson-note sheet)
 * inside a responsive container.
 *
 * DESKTOP IS LOCKED: the result is capped at 1, so whenever the container is
 * at least as wide as the content the scale is exactly 1 and every consumer is
 * a no-op. Only viewports narrower than the fixed content ever scale down.
 */
export function useFitToWidth(contentWidth: number, enabled: boolean): {
  ref: (el: HTMLElement | null) => void;
  scale: number;
} {
  const [scale, setScale] = useState(1);
  const elRef = useRef<HTMLElement | null>(null);

  const measure = useCallback(() => {
    const el = elRef.current;
    if (!el || !enabled || !contentWidth) {
      setScale(1);
      return;
    }
    const avail = el.clientWidth;
    if (!avail) return;
    const next = Math.min(1, avail / contentWidth);
    // Round so tiny resize jitter does not re-render the whole document.
    setScale(Math.max(0.2, Math.round(next * 1000) / 1000));
  }, [contentWidth, enabled]);

  const ref = useCallback((el: HTMLElement | null) => {
    elRef.current = el;
    measure();
  }, [measure]);

  useEffect(() => {
    measure();
    const el = elRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return { ref, scale: enabled ? scale : 1 };
}

export default useFitToWidth;
