// Manual AI Edit — dispatch layer.
//
// Thin wrapper that maps teacher prompts and Quick Suggestion chips to
// the autonomous operator (operator.ts). Free-form prompts are classified
// with a small keyword table, while chips carry a `forcedCause` so the
// operator can skip diagnosis and go straight to a strategy ladder.

import type { PresentationController } from "@/lib/smartboard/presentationAI/controller";
import type {
  EditIntent,
  EditReport,
  EditTarget,
  OperatorEvent,
  RootCause,
} from "./types";
import { runOperator } from "./operator";

const INTENT_KEYWORDS: { intent: EditIntent; patterns: RegExp[] }[] = [
  { intent: "sync-note", patterns: [/note/i] },
  { intent: "sync-floating", patterns: [/floating|chip|#|hashtag/i] },
  { intent: "sync-line", patterns: [/line missing|missing line|solution line|solution missing/i] },
  { intent: "sync-highlight", patterns: [/highlight/i] },
  { intent: "sync-structure", patterns: [/render|structure|fraction|square root|exponent|subscript|superscript/i] },
  { intent: "fix-spacing", patterns: [/spacing|space|too close|too far/i] },
  { intent: "fix-overlap", patterns: [/overlap|collide|on top of|colliding/i] },
  { intent: "fix-order", patterns: [/order|sequence|reveal/i] },
  { intent: "fix-active-line", patterns: [/active line|wrong line|current line/i] },
  { intent: "fix-scroll", patterns: [/scroll|out of view|off ?screen|not visible/i] },
  { intent: "move-note", patterns: [/move .*note|relocate|reposition .*note/i] },
  { intent: "rerender-structure", patterns: [/broken|redraw|re-?render/i] },
];

const INTENT_TO_CAUSE: Partial<Record<EditIntent, RootCause>> = {
  "sync-note": "render-empty",
  "sync-floating": "chip-not-registered",
  "sync-line": "queue-missed",
  "sync-structure": "render-empty",
  "rerender-structure": "render-empty",
  "fix-spacing": "blocked-by-overlap",
  "fix-overlap": "blocked-by-overlap",
  "fix-order": "queue-missed",
  "fix-active-line": "active-line-drift",
  "fix-scroll": "outside-viewport",
  "move-note": "render-empty",
  "sync-highlight": "active-line-drift",
};

export const classifyIntent = (
  target: EditTarget,
  prompt: string,
): EditIntent => {
  const p = prompt.trim().toLowerCase();
  if (p) {
    for (const row of INTENT_KEYWORDS) {
      if (row.patterns.some((rx) => rx.test(p))) return row.intent;
    }
  }
  switch (target.kind) {
    case "teacher-note":
      return "sync-note";
    case "floating-number":
      return "sync-floating";
    case "solution-line":
    case "question":
      return "sync-line";
    case "math-structure":
      return "rerender-structure";
    default:
      return "unknown";
  }
};

/** Free-form prompt run. */
export const runManualEdit = async (
  target: EditTarget,
  prompt: string,
  ctrl: PresentationController,
  onEvent?: (e: OperatorEvent) => void,
): Promise<EditReport> => {
  const intent = classifyIntent(target, prompt);
  const forcedCause = INTENT_TO_CAUSE[intent];
  return runOperator(target, ctrl, { intent, forcedCause, onEvent });
};

/** Quick-Suggestion workflow — carries a preset root cause. */
export interface SuggestedWorkflow {
  label: string;
  intent: EditIntent;
  cause: RootCause;
  hint: string;
}

export const SUGGESTED_WORKFLOWS: SuggestedWorkflow[] = [
  { label: "Note missing on board", intent: "sync-note", cause: "render-empty", hint: "Locate note, replay click, verify." },
  { label: "Add floating number", intent: "sync-floating", cause: "chip-not-registered", hint: "Open #, pick chip, verify." },
  { label: "Solution line missing", intent: "sync-line", cause: "queue-missed", hint: "Erase, safe row, rewrite, verify." },
  { label: "Fix overlap", intent: "fix-overlap", cause: "blocked-by-overlap", hint: "Safe row, replay." },
  { label: "Fix spacing", intent: "fix-spacing", cause: "blocked-by-overlap", hint: "Drop row, replay." },
  { label: "Bring into view", intent: "fix-scroll", cause: "outside-viewport", hint: "Scroll to target." },
  { label: "Reset active line", intent: "fix-active-line", cause: "active-line-drift", hint: "Reset sensor, replay." },
  { label: "Re-render structure", intent: "rerender-structure", cause: "render-empty", hint: "Erase, safe row, rewrite." },
];

export const runSuggestedWorkflow = async (
  target: EditTarget,
  wf: SuggestedWorkflow,
  ctrl: PresentationController,
  onEvent?: (e: OperatorEvent) => void,
): Promise<EditReport> => {
  return runOperator(target, ctrl, {
    intent: wf.intent,
    forcedCause: wf.cause,
    onEvent,
  });
};

// Back-compat alias for older imports.
export const SUGGESTED_PROMPTS = SUGGESTED_WORKFLOWS.map((w) => ({
  label: w.label,
  prompt: w.hint,
}));
