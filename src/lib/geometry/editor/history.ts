// Tiny undo/redo stack scoped to one editor session.

import type { GeometryScene } from "../scene";

export interface History {
  past: GeometryScene[];
  future: GeometryScene[];
}

export const emptyHistory = (): History => ({ past: [], future: [] });

export function push(history: History, prev: GeometryScene): History {
  return { past: [...history.past.slice(-50), prev], future: [] };
}

export function undo(history: History, current: GeometryScene): { scene: GeometryScene; history: History } | null {
  if (history.past.length === 0) return null;
  const prev = history.past[history.past.length - 1];
  return {
    scene: prev,
    history: { past: history.past.slice(0, -1), future: [current, ...history.future].slice(0, 50) },
  };
}

export function redo(history: History, current: GeometryScene): { scene: GeometryScene; history: History } | null {
  if (history.future.length === 0) return null;
  const next = history.future[0];
  return {
    scene: next,
    history: { past: [...history.past, current].slice(-50), future: history.future.slice(1) },
  };
}
