// Which AI owns the lesson workspace.
//
//  • "copilot" — MathGPL Co-Pilot is the single mathematical assistant.
//    Every per-section AI control is hidden while this mode is active.
//  • "builder" — the existing AI-assisted environment: section AI chips,
//    AI Edit, whole-lesson AI assist.
//
// Kept in a tiny external store (not React context) because ProseMirror node
// views render outside the page's React tree, so they can't read a provider
// mounted by the editor page.

import { useSyncExternalStore } from "react";

export type LessonAiMode = "copilot" | "builder";

const KEY = "mathgpl.lessonAiMode";
const listeners = new Set<() => void>();

const read = (): LessonAiMode => {
  if (typeof window === "undefined") return "builder";
  return window.localStorage.getItem(KEY) === "copilot" ? "copilot" : "builder";
};

let current: LessonAiMode = "builder";
let primed = false;

function snapshot(): LessonAiMode {
  if (!primed && typeof window !== "undefined") {
    primed = true;
    current = read();
  }
  return current;
}

export function setLessonAiMode(mode: LessonAiMode) {
  primed = true;
  if (current === mode) return;
  current = mode;
  try {
    window.localStorage.setItem(KEY, mode);
  } catch {
    // private mode / quota — the session still works, it just won't persist.
  }
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Live mode. SSR renders "builder" so hydration always matches. */
export function useLessonAiMode(): LessonAiMode {
  return useSyncExternalStore(subscribe, snapshot, () => "builder");
}

/** True when the per-section AI controls should be visible. */
export function useBuilderAiVisible(): boolean {
  return useLessonAiMode() === "builder";
}
