// Report System — infinite X axis behaviour.
//
// The plot region scrolls forever to the right; the newest entry is what the
// teacher cares about, so the viewport is pinned to the right edge whenever the
// series grows (older entries slide out to the left). Once the user scrolls
// back manually, we stop stealing their position until new data arrives.

import { useCallback, useEffect, useRef } from "react";

export const useLatestScroll = (count: number) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastCount = useRef(-1);

  const pin = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
  }, []);

  useEffect(() => {
    if (count === lastCount.current) return;
    lastCount.current = count;
    // Wait for layout so scrollWidth reflects the new entry.
    const id = requestAnimationFrame(pin);
    return () => cancelAnimationFrame(id);
  }, [count, pin]);

  return { ref, pin };
};
