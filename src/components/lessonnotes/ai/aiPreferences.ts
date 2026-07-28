// Layer 2 — Teacher AI preferences.
//
// Layer 1 (subject/topic/objectives/notation/continuity) is always injected by
// `collectLessonContext` + the backend standards; the teacher never sees it.
// This file is ONLY the teacher-facing switches that live behind the gear in
// the AI popover. Stored per lesson note in localStorage (no schema change).

export type AiDepth = "brief" | "standard" | "detailed";

export interface AiPreferences {
  stepByStep: boolean;
  simplifyEnglish: boolean;
  realLife: boolean;
  scaffolded: boolean;
  formulaFirst: boolean;
  commonMistakes: boolean;
  depth: AiDepth;
  level: string;
  /** Standing instruction — "exactly what I want from every solution here". */
  standing: string;
}

export const DEFAULT_AI_PREFERENCES: AiPreferences = {
  stepByStep: true,
  simplifyEnglish: false,
  realLife: false,
  scaffolded: false,
  formulaFirst: false,
  commonMistakes: false,
  depth: "standard",
  level: "",
  standing: "",
};

export const AI_PREFS_EVENT = "lesson-notes:ai-prefs-changed";

const keyFor = (notebookId?: string) =>
  notebookId ? `lesson-notes:ai-prefs:${notebookId}` : "lesson-notes:ai-prefs:default";

export function loadAiPreferences(notebookId?: string): AiPreferences {
  try {
    const raw = localStorage.getItem(keyFor(notebookId));
    if (!raw) return { ...DEFAULT_AI_PREFERENCES };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_AI_PREFERENCES, ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch {
    return { ...DEFAULT_AI_PREFERENCES };
  }
}

export function saveAiPreferences(notebookId: string | undefined, prefs: AiPreferences) {
  try {
    localStorage.setItem(keyFor(notebookId), JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent(AI_PREFS_EVENT, { detail: { notebookId } }));
  } catch {
    /* storage disabled — preferences just won't persist */
  }
}

/** Short labels for the chips shown in the prompt view. */
export function activePreferenceChips(p: AiPreferences): string[] {
  const chips: string[] = [];
  if (p.stepByStep) chips.push("Step-by-step");
  if (p.simplifyEnglish) chips.push("Simple English");
  if (p.realLife) chips.push("Real-life");
  if (p.scaffolded) chips.push("Scaffolded");
  if (p.formulaFirst) chips.push("Formula first");
  if (p.commonMistakes) chips.push("Common mistakes");
  if (p.depth !== "standard") chips.push(p.depth === "brief" ? "Brief" : "Detailed");
  if (p.level.trim()) chips.push(p.level.trim());
  if (p.standing.trim()) chips.push("Standing note");
  return chips;
}

/** True when the teacher has asked for anything beyond the plain default. */
export function hasCustomPreferences(p: AiPreferences): boolean {
  return (
    p.simplifyEnglish || p.realLife || p.scaffolded || p.formulaFirst || p.commonMistakes ||
    p.depth !== "standard" || p.level.trim().length > 0 || p.standing.trim().length > 0 ||
    p.stepByStep !== DEFAULT_AI_PREFERENCES.stepByStep
  );
}

/**
 * Compile the switches into a prompt directive block. Appended AFTER the
 * pedagogy / QUESTION_LOCK / continuity standards so those always win.
 */
export function buildPreferenceDirective(p: AiPreferences): string {
  const lines: string[] = [];
  if (p.stepByStep) lines.push("Show every step of the working on its own line. Never skip a transition.");
  if (p.simplifyEnglish) lines.push("Use simple classroom English. Short sentences, everyday words.");
  if (p.realLife) lines.push("Where it fits naturally, anchor the content in a familiar real-life situation.");
  if (p.scaffolded) lines.push("Scaffold: give a guiding hint or leading question before the full working.");
  if (p.formulaFirst) lines.push("State the governing formula or rule first, then apply it.");
  if (p.commonMistakes) lines.push("End with one short note on the mistake students commonly make here.");
  if (p.depth === "brief") lines.push("Keep it brief — the fewest lines that still teach it correctly.");
  if (p.depth === "detailed") lines.push("Be thorough — explain the reasoning behind each step.");
  if (p.level.trim()) lines.push(`Pitch the language and difficulty at: ${p.level.trim()}.`);
  if (p.standing.trim()) {
    lines.push(`Teacher's standing instruction for this lesson note (always apply): ${p.standing.trim()}`);
  }
  if (!lines.length) return "";
  return (
    "TEACHER PREFERENCES (apply to this output; they never override the question, " +
    "the pedagogy standard, or lesson continuity):\n" +
    lines.map((l) => `• ${l}`).join("\n")
  );
}
