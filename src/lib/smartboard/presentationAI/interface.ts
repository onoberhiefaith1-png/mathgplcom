// Presentation AI — Smartboard interface catalogue.
// Declarative "training manual" that tells the AI every tool available on
// the Smartboard, its purpose, and when to use it. Repair recipes and the
// stepper reference these ids so the AI's action log reads like teacher
// moves ("floating-pick", "note-drop") rather than raw controller calls.

import type { PresentationController } from "./controller";

export type ToolId =
  | "floating-panel-toggle"
  | "floating-pick"
  | "eraser"
  | "sensor-move"
  | "sensor-goto-line"
  | "note-drop"
  | "scroll";

export interface ToolSpec {
  id: ToolId;
  label: string;
  purpose: string;
  whenToUse: string;
}

export const SMARTBOARD_TOOLS: Record<ToolId, ToolSpec> = {
  "floating-panel-toggle": {
    id: "floating-panel-toggle",
    label: "Floating Number panel (#)",
    purpose: "Open the Floating Number panel that holds every filler chip for the current subsection.",
    whenToUse: "Before placing any Floating Number for the current line.",
  },
  "floating-pick": {
    id: "floating-pick",
    label: "Click a Floating Number",
    purpose: "Place the next required filler onto the Smartboard row.",
    whenToUse: "Once per filler, in the order given by the Presenter Preview.",
  },
  "eraser": {
    id: "eraser",
    label: "Eraser",
    purpose: "Remove one wrong object (a stray token, an overlapping row, a misplaced note).",
    whenToUse: "Only after an error is confirmed. Never erase correct work.",
  },
  "sensor-move": {
    id: "sensor-move",
    label: "Cursor D-Pad",
    purpose: "Move the writing sensor Up / Down / Left / Right.",
    whenToUse: "When the next object would overlap or land in the wrong region.",
  },
  "sensor-goto-line": {
    id: "sensor-goto-line",
    label: "Jump sensor to line",
    purpose: "Set the writing sensor to the start of a specific presentation line.",
    whenToUse: "Before writing a filler or Teacher Note on that line.",
  },
  "note-drop": {
    id: "note-drop",
    label: "Drop Teacher Note",
    purpose: "Write the current line's Teacher Note at the sensor position.",
    whenToUse: "When the Presenter Preview line carries a renderable note.",
  },
  "scroll": {
    id: "scroll",
    label: "Scroll board",
    purpose: "Bring a line into view.",
    whenToUse: "When the target line is above or below the visible board region.",
  },
};

/** Bindings from tool ids to controller actions. Missing controller methods
 *  degrade gracefully — the tool becomes a no-op and the caller can fall
 *  back to a lower-level primitive. */
export const runTool = async (
  id: ToolId,
  ctrl: PresentationController,
  args: {
    lineIdx?: number;
    fillerIdx?: number;
    dir?: "up" | "down" | "left" | "right";
    open?: boolean;
  } = {},
): Promise<void> => {
  switch (id) {
    case "floating-panel-toggle":
      if (args.open === false) ctrl.closeFloatingPanel?.();
      else ctrl.openFloatingPanel?.();
      return;
    case "floating-pick":
      if (args.lineIdx !== undefined && args.fillerIdx !== undefined) {
        ctrl.pickFloatingNumber?.(args.lineIdx, args.fillerIdx);
      }
      return;
    case "eraser":
      if (args.lineIdx !== undefined) ctrl.eraseNoteAt?.(args.lineIdx);
      return;
    case "sensor-goto-line":
      if (args.lineIdx !== undefined) ctrl.setActiveLineIdx(args.lineIdx);
      return;
    case "note-drop":
      // caller is expected to compose with the raw note text.
      return;
    case "scroll":
      if (args.lineIdx !== undefined) ctrl.scrollBoardTo?.(args.lineIdx);
      return;
    default:
      return;
  }
};

/** The AI's operating manual for driving the Smartboard.
 *  Each diagnosis's `suggestedFix` may reference a rule number so the
 *  Diagnosis Panel reads like teacher-style instructions. */
export const SMARTBOARD_PROCEDURE: { n: number; rule: string }[] = [
  { n: 1, rule: "Read the target line from the Presenter Preview (equation + fillers, in Preview order)." },
  { n: 2, rule: "Scroll the Smartboard so the target row is visible below the Solution header." },
  { n: 3, rule: "Move the sensor to a safe row. If the row above is a fraction denominator, drop one extra row." },
  { n: 4, rule: "If this is the question line (line 1 of the section), write it whole via writeQuestionLine — do NOT open the # panel." },
  { n: 5, rule: "Otherwise open the # (Floating Number) panel and click each chip in Preview order." },
  { n: 6, rule: "After each chip, verify the row prefix equals the equation prefix up to that chip. On mismatch: erase this line's row, move sensor to a fresh safe row, retry once." },
  { n: 7, rule: "If the line has a Teacher Note, close the # panel, scroll, place sensor, drop the note, mark shown." },
  { n: 8, rule: "line-verify: compare board row signature to equation signature. On mismatch: erase the row and rewrite once, then raise line-mismatch." },
  { n: 9, rule: "On any AI mistake, use the eraser on the AI's own row only — never a sibling row." },
  { n: 10, rule: "Prev/Next chapter buttons are used only when the beat cursor drifts (beat-cursor-drift repair)." },
];

/** Human-readable rule text for a rule number, prefixed with the rule id. */
export const rule = (n: number): string => {
  const r = SMARTBOARD_PROCEDURE.find((x) => x.n === n);
  return r ? `Rule ${r.n}: ${r.rule}` : `Rule ${n}`;
};
