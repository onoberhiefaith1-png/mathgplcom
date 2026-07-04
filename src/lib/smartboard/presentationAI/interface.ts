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
