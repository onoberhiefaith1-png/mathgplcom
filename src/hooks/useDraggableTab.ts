import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Makes a small floating tab draggable left/right so it can be moved away from
 * whatever sits behind it. Horizontal only; the offset persists for the session.
 */
export function useDraggableTab(storageKey: string) {
  const [offsetX, setOffsetX] = useState(0);
  const dragRef = useRef<{ startX: number; startOffset: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) setOffsetX(Number(raw) || 0);
    } catch {
      // ignore
    }
  }, [storageKey]);

  const persist = useCallback(
    (value: number) => {
      try {
        sessionStorage.setItem(storageKey, String(Math.round(value)));
      } catch {
        // ignore
      }
    },
    [storageKey],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      dragRef.current = { startX: event.clientX, startOffset: offsetX, moved: false };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [offsetX],
  );

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(delta) < 4) return;
    drag.moved = true;
    setDragging(true);
    const half = window.innerWidth / 2 - 40;
    const next = Math.max(-half, Math.min(half, drag.startOffset + delta));
    setOffsetX(next);
  }, []);

  const justDragged = useRef(false);

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      dragRef.current = null;
      setDragging(false);
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      if (drag?.moved) {
        justDragged.current = true;
        persist(offsetX);
        window.setTimeout(() => {
          justDragged.current = false;
        }, 0);
      }
    },
    [offsetX, persist],
  );

  /** True right after a drag, so click handlers can ignore the release. */
  const wasDragged = () => justDragged.current;

  return { offsetX, dragging, onPointerDown, onPointerMove, endDrag, wasDragged };
}

