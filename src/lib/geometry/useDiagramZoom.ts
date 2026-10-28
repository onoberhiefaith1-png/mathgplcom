// Per-diagram visual zoom, remembered locally.
//
// The value is a pure presentation multiplier: the renderer scales width and
// height by the SAME factor, so geometry and proportions are untouched.

import { useCallback, useEffect, useState } from "react";
import { clampDiagramZoom } from "@/components/lessonnotes/geometry-editor/DiagramZoomControl";

const prefix = "diagram:zoom:";

function read(key: string | null | undefined): number {
  if (!key || typeof window === "undefined") return 1;
  try {
    const raw = window.localStorage.getItem(prefix + key);
    return raw ? clampDiagramZoom(Number(raw)) : 1;
  } catch {
    return 1;
  }
}

export function useDiagramZoom(key?: string | null): {
  zoom: number;
  setZoom: (next: number) => void;
} {
  const [zoom, setZoomState] = useState(1);

  // Read after mount so server rendering and hydration always agree.
  useEffect(() => { setZoomState(read(key)); }, [key]);

  const setZoom = useCallback((next: number) => {
    const z = clampDiagramZoom(next);
    setZoomState(z);
    if (!key || typeof window === "undefined") return;
    try { window.localStorage.setItem(prefix + key, String(z)); } catch { /* noop */ }
  }, [key]);

  return { zoom, setZoom };
}

export default useDiagramZoom;
