// Guaranteed exit for any full-screen surface.
//
// A layer that covers the whole app must always be dismissible: if its close
// button is ever missed, misplaced, or hidden by a failure, Escape still gets
// the teacher back to the workspace. Without this a stuck overlay looks exactly
// like a frozen application.

import { useEffect } from "react";

export function useEscapeClose(onClose: (() => void) | undefined, enabled = true) {
  useEffect(() => {
    if (!enabled || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    // Capture phase: the surface closes even if an inner widget swallows keys.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, enabled]);
}

export default useEscapeClose;
