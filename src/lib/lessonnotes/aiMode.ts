// Which mode owns the lesson workspace. Exactly one is ever active.
//
//  • "manual"     — DEFAULT. The teacher builds the lesson: type, paste,
//    upload, draw, tables, equations. NO AI generation affordances at all.
//    AI Edit (selection and diagram) stays available, because it edits what
//    the teacher already wrote — it never creates the lesson.
//  • "mathengine" — AI Builder: the per-section AI tools are available again,
//    and every one of them goes through the Engine service.
//  • "copilot"    — MathGPL Co-Pilot: the assistant dock.
//
// Kept in a tiny external store (not React context) because ProseMirror node
// views render outside the page's React tree, so they can't read a provider
// mounted by the editor page.

import { useSyncExternalStore } from "react";

export type LessonAiMode = "manual" | "copilot" | "mathengine";

// v2: Manual is the new default, so the old key is deliberately abandoned —
// every teacher starts in Manual mode regardless of what they used before.
const KEY = "mathgpl.lessonMode.v2";
const listeners = new Set<() => void>();

const read = (): LessonAiMode => {
  if (typeof window === "undefined") return "manual";
  const v = window.localStorage.getItem(KEY);
  return v === "copilot" || v === "mathengine" ? v : "manual";
};

let current: LessonAiMode = "manual";
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

/** Live mode. SSR renders Manual mode so hydration always matches. */
export function useLessonAiMode(): LessonAiMode {
  return useSyncExternalStore(subscribe, snapshot, () => "manual");
}

/** True when the per-section AI GENERATION controls should be visible. */
export function useSectionAiVisible(): boolean {
  return useLessonAiMode() === "mathengine";
}

/** Legacy alias — same meaning as useSectionAiVisible(). */
export const useBuilderAiVisible = useSectionAiVisible;

export const LESSON_MODE_LABELS: Record<LessonAiMode, string> = {
  manual: "Manual",
  mathengine: "AI Builder",
  copilot: "MathGPL Co-Pilot",
};

export const LESSON_MODE_NOTES: Record<LessonAiMode, string> = {
  manual: "Manual — you build the lesson; AI only edits what you select.",
  mathengine: "AI Builder — section AI tools are available.",
  copilot: "Co-Pilot active — section AI tools are hidden.",
};
