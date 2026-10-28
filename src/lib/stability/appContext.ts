/**
 * Central application state model.
 *
 * Individual pages used to keep their own idea of "where am I / what am I
 * working on", so a recovery could land the teacher back on a waiting screen.
 * This tiny store is the single source of truth for the current context and is
 * mirrored to sessionStorage so a manual refresh restores the same place.
 */
import { useEffect, useState } from "react";

export type AppContextState = {
  route: string | null;
  lessonId: string | null;
  questionId: string | null;
  sessionId: string | null;
  boardId: string | null;
  solutionId: string | null;
  evaluationRunning: boolean;
  unsavedChanges: boolean;
};

const STORAGE_KEY = "mathgpl:app-context";

const initial: AppContextState = {
  route: null,
  lessonId: null,
  questionId: null,
  sessionId: null,
  boardId: null,
  solutionId: null,
  evaluationRunning: false,
  unsavedChanges: false,
};

let state: AppContextState = { ...initial };
const listeners = new Set<(next: AppContextState) => void>();
let persistTimer: number | undefined;

function persist() {
  if (typeof window === "undefined") return;
  if (persistTimer) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    try {
      const { evaluationRunning: _ignored, ...durable } = state;
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(durable));
    } catch {
      // Storage full or blocked — context restoration is a convenience, never required.
    }
  }, 250);
}

export function hydrateAppContext(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    state = { ...state, ...(JSON.parse(raw) as Partial<AppContextState>), evaluationRunning: false };
  } catch {
    // Ignore malformed stored context.
  }
}

/** Forget the current context entirely — used when an account leaves this browser. */
export function resetAppContext(): void {
  state = { ...initial };
  if (typeof window !== "undefined") {
    if (persistTimer) window.clearTimeout(persistTimer);
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage blocked — the in-memory reset above is what matters.
    }
  }
  for (const listener of listeners) listener(state);
}

export function getAppContext(): AppContextState {
  return state;
}

export function setAppContext(patch: Partial<AppContextState>): void {
  let changed = false;
  for (const [key, value] of Object.entries(patch) as Array<[keyof AppContextState, never]>) {
    if (state[key] !== value) changed = true;
  }
  if (!changed) return;
  state = { ...state, ...patch };
  persist();
  for (const listener of listeners) listener(state);
}

export function subscribeAppContext(listener: (next: AppContextState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppContext(): AppContextState {
  const [value, setValue] = useState(state);
  useEffect(() => subscribeAppContext(setValue), []);
  return value;
}

/** Declare the context a screen owns; cleared fields are left untouched on unmount. */
export function useDeclareAppContext(patch: Partial<AppContextState>): void {
  const fingerprint = JSON.stringify(patch);
  useEffect(() => {
    setAppContext(JSON.parse(fingerprint) as Partial<AppContextState>);
  }, [fingerprint]);
}
