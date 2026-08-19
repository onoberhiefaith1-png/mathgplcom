// Which AI owns the lesson workspace. Exactly one is ever active.
//
//  • "copilot"    — MathGPL Co-Pilot: the application assistant. It understands
//    structure, workflow and editing, and calls the Math Engine whenever the
//    request needs mathematics. Per-section AI markers stay hidden.
//  • "mathengine" — MathGPL Math Engine: the section tools are available again,
//    and every one of them goes through the Engine service.
//
// Kept in a tiny external store (not React context) because ProseMirror node
// views render outside the page's React tree, so they can't read a provider
// mounted by the editor page.

import { useSyncExternalStore } from "react";

export type LessonAiMode = "copilot" | "mathengine";

const KEY = "mathgpl.lessonAiMode";
const listeners = new Set<() => void>();

const read = (): LessonAiMode => {
  if (typeof window === "undefined") return "mathengine";
  // "builder" is the previous name of Math Engine mode.
  return window.localStorage.getItem(KEY) === "copilot" ? "copilot" : "mathengine";
};

let current: LessonAiMode = "mathengine";
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

/** Live mode. SSR renders Math Engine mode so hydration always matches. */
export function useLessonAiMode(): LessonAiMode {
  return useSyncExternalStore(subscribe, snapshot, () => "mathengine");
}

/** True when the per-section AI controls should be visible. */
export function useBuilderAiVisible(): boolean {
  return useLessonAiMode() === "mathengine";
}
