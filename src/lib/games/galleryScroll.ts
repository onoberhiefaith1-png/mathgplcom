// Persist Gallery vertical scroll position per class (per-device).
// Ratio = scrollTop / max(1, scrollHeight - clientHeight), so the position
// stays sensible when the canvas is later extended or shrunk.
import { useCallback, useEffect, useRef } from "react";

const keyFor = (classId: string) => `gallery-scroll:${classId}`;

export const loadGalleryScrollRatio = (classId: string): number | null => {
  try {
    const raw = localStorage.getItem(keyFor(classId));
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
  } catch {
    return null;
  }
};

export const saveGalleryScrollRatio = (classId: string, ratio: number): void => {
  try {
    localStorage.setItem(keyFor(classId), String(Math.min(1, Math.max(0, ratio))));
  } catch {
    /* ignore quota / privacy errors */
  }
};

/**
 * Attach to any scrollable container to persist and restore the Gallery
 * scroll position for `classId`. Returns a ref callback and an imperative
 * `markJumpToBottom()` that skips restore once (for the Extend action).
 */
export const useGalleryScrollMemory = (classId: string | undefined) => {
  const elRef = useRef<HTMLElement | null>(null);
  const restoredRef = useRef(false);
  const jumpBottomRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const tryRestore = useCallback(() => {
    const el = elRef.current;
    if (!el || !classId || restoredRef.current) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) return; // not laid out yet
    if (jumpBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      jumpBottomRef.current = false;
      restoredRef.current = true;
      return;
    }
    const ratio = loadGalleryScrollRatio(classId);
    if (ratio != null) el.scrollTop = ratio * maxScroll;
    restoredRef.current = true;
  }, [classId]);

  // Attach as ref callback so it works across re-mounts (view/edit toggle).
  const ref = useCallback((el: HTMLElement | null) => {
    // Detach old
    const prev = elRef.current;
    if (prev && (prev as HTMLElement & { __glScroll?: EventListener }).__glScroll) {
      prev.removeEventListener("scroll", (prev as HTMLElement & { __glScroll?: EventListener }).__glScroll!);
      delete (prev as HTMLElement & { __glScroll?: EventListener }).__glScroll;
    }
    elRef.current = el;
    restoredRef.current = false;
    if (!el || !classId) return;

    const onScroll = () => {
      if (!restoredRef.current) return; // don't overwrite before restore
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const maxScroll = el.scrollHeight - el.clientHeight;
        if (maxScroll <= 0) return;
        saveGalleryScrollRatio(classId, el.scrollTop / maxScroll);
      });
    };
    (el as HTMLElement & { __glScroll?: EventListener }).__glScroll = onScroll;
    el.addEventListener("scroll", onScroll, { passive: true });

    // Try restore now and again after next frame (in case layout is pending).
    tryRestore();
    requestAnimationFrame(tryRestore);
  }, [classId, tryRestore]);

  // Flush on unmount.
  useEffect(() => {
    return () => {
      const el = elRef.current;
      if (!el || !classId) return;
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll > 0) saveGalleryScrollRatio(classId, el.scrollTop / maxScroll);
    };
  }, [classId]);

  const markJumpToBottom = useCallback(() => {
    jumpBottomRef.current = true;
    restoredRef.current = false;
    // Try immediately if element is already ready.
    requestAnimationFrame(() => {
      const el = elRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
      jumpBottomRef.current = false;
      restoredRef.current = true;
    });
  }, []);

  const retryRestore = useCallback(() => {
    restoredRef.current = false;
    requestAnimationFrame(tryRestore);
  }, [tryRestore]);

  return { ref, markJumpToBottom, retryRestore };
};
