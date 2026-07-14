// Show-on-hover + N-second idle auto-hide. Used by every tabular asset's
// bottom toolbar (Add Row/Column etc.). The teacher never has to click to
// reveal the toolbar — moving the pointer over the asset shows it; leaving
// it alone for `idleMs` hides it again. Any activity resets the timer.

import { useCallback, useEffect, useRef, useState } from "react";

export interface HoverIdleBind {
  onPointerEnter: () => void;
  onPointerMove: () => void;
  onPointerLeave: () => void;
  onPointerDown: () => void;
}

export function useHoverIdleVisibility(opts?: {
  idleMs?: number;
  /** When true, force-visible regardless of hover/idle (e.g. selected). */
  forceVisible?: boolean;
}) {
  const idleMs = opts?.idleMs ?? 10000;
  const force = !!opts?.forceVisible;
  const [visible, setVisible] = useState(force);
  const insideRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };
  const armTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      if (!insideRef.current) setVisible(false);
    }, idleMs);
  }, [idleMs]);

  const ping = useCallback(() => {
    setVisible(true);
    clearTimer();
    // If pointer left, still start countdown; if inside, wait until leave.
    if (!insideRef.current) armTimer();
  }, [armTimer]);

  const bind: HoverIdleBind = {
    onPointerEnter: () => { insideRef.current = true; setVisible(true); clearTimer(); },
    onPointerMove: () => { setVisible(true); clearTimer(); },
    onPointerLeave: () => { insideRef.current = false; armTimer(); },
    onPointerDown: () => { setVisible(true); clearTimer(); if (!insideRef.current) armTimer(); },
  };

  useEffect(() => {
    if (force) { setVisible(true); clearTimer(); }
    else if (!insideRef.current) armTimer();
    return clearTimer;
  }, [force, armTimer]);

  useEffect(() => () => clearTimer(), []);

  return { visible: visible || force, bind, ping };
}
