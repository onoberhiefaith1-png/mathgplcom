// Which mode owns the lesson workspace. Exactly one is ever active.
//
//  • "manual"  — DEFAULT. The teacher builds the lesson. AI Edit (highlight or
//    the top-bar button) stays available: it structures content the teacher
//    brings, it never builds the lesson on its own.
//  • "copilot" — MathGPL Co-Pilot: the assistant dock PLUS every former
//    AI Builder tool (per-section AI buttons). Builder is no longer a mode.
//
// Kept in a tiny external store (not React context) because ProseMirror node
// views render outside the page's React tree.

import { useSyncExternalStore } from "react";

export type LessonAiMode = "manual" | "copilot";

const KEY = "mathgpl.lessonMode.v2";
const listeners = new Set<() => void>();

/** Old saved "mathengine" (AI Builder) now opens as Co-Pilot. */
export function normalizeLessonMode(v: string | null | undefined): LessonAiMode {
  return v === "copilot" || v === "mathengine" ? "copilot" : "manual";
}

const read = (): LessonAiMode => {
  if (typeof window === "undefined") return "manual";
  return normalizeLessonMode(window.localStorage.getItem(KEY));
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

export function useLessonAiMode(): LessonAiMode {
  return useSyncExternalStore(subscribe, snapshot, () => "manual");
}

/** True when the per-section AI GENERATION controls should be visible. */
export function useSectionAiVisible(): boolean {
  return useLessonAiMode() === "copilot";
}

export const useBuilderAiVisible = useSectionAiVisible;

export const LESSON_MODE_LABELS: Record<LessonAiMode, string> = {
  manual: "Manual",
  copilot: "MathGPL Co-Pilot",
};

export const LESSON_MODE_NOTES: Record<LessonAiMode, string> = {
  manual: "Manual — you build the lesson; AI Edit structures what you bring.",
  copilot: "Co-Pilot — full lesson generation and every section AI tool.",
};
