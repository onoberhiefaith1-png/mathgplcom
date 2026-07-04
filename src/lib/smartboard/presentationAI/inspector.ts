// Presentation AI — inspector.
// Compares expected state (from the Preview model) to actual Smartboard state
// pulled through the controller, and emits typed Issues.

import type { PresentationController } from "./controller";
import type { Issue } from "./types";
import { isRenderableNote, type PresentationStep } from "./model";

let idCounter = 0;
const nextId = () => `ai-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

const captionFor = (step: PresentationStep): string =>
  step.beat.caption ?? step.beat.id;

const mkIssue = (
  step: PresentationStep,
  patch: Omit<
    Issue,
    "id" | "createdAt" | "section" | "beatId" | "lineIdx"
  > & { lineIdx?: number | null },
): Issue => ({
  id: nextId(),
  createdAt: Date.now(),
  section: captionFor(step),
  beatId: step.beat.id,
  lineIdx: patch.lineIdx ?? (step.kind === "line" ? step.lineIdx : null),
  ...patch,
});

export const inspectStep = (
  step: PresentationStep,
  ctrl: PresentationController,
): Issue[] => {
  const issues: Issue[] = [];
  const cursor = ctrl.getBeatCursor();
  const beat = ctrl.beats[cursor];

  // Beat cursor drift
  if (!beat || beat.id !== step.beat.id) {
    issues.push(
      mkIssue(step, {
        kind: "beat-cursor-drift",
        summary: "Smartboard is on the wrong beat.",
        expected: `${step.beat.id} (${captionFor(step)})`,
        actual: beat ? `${beat.id} (${beat.caption ?? beat.id})` : "no beat",
        probableCause:
          "beatCursor was not advanced to the expected step, or drifted from an external state change.",
        suggestedFix: "Force setBeatCursor to the expected beat index.",
        repairable: true,
      }),
    );
    return issues; // Everything downstream is meaningless until we fix the beat.
  }

  if (step.kind === "beat") return issues;

  // Line cursor drift
  const activeLineIdx = ctrl.getActiveLineIdx();
  if (activeLineIdx !== step.lineIdx) {
    issues.push(
      mkIssue(step, {
        kind: "line-cursor-drift",
        summary: "Smartboard is on the wrong solution line.",
        expected: `line ${step.lineIdx + 1}`,
        actual: `line ${activeLineIdx + 1}`,
        probableCause: "activeLineIdx did not track the autoplay advancement.",
        suggestedFix: "Force setActiveLineIdx to the expected line index.",
        repairable: true,
      }),
    );
  }

  // Note presence
  const rawNote = (step.line.notebook ?? "").trim();
  if (isRenderableNote(rawNote)) {
    const shown = ctrl.getShownNotebookIdx();
    if (!shown.has(step.lineIdx)) {
      issues.push(
        mkIssue(step, {
          kind: "note-missing",
          summary: "Teacher Note exists in Presenter Preview but is missing on the Smartboard.",
          expected: rawNote.slice(0, 120),
          actual: "no note rendered",
          probableCause:
            "The note-attention effect did not run for this line, or writeProseLineOnBoard was blocked.",
          suggestedFix: "Call writeProseLineOnBoard(note) and record the line in shownNotebookIdx.",
          repairable: true,
        }),
      );
    }
  }

  // Floating chips — we cannot always see the rendered board rows, so we
  // check the data path: the reservoir must actually carry fillers for a
  // non-notebook-only line. If it doesn't, escalate as structural.
  const line = step.line;
  if (!line.notebookOnly && line.equation.trim() && line.fillers.length === 0) {
    issues.push(
      mkIssue(step, {
        kind: "floating-missing",
        summary: "Floating Number missing for a solution line.",
        expected: "at least one filler chip",
        actual: "no fillers in reservoir",
        probableCause:
          "The floating-number generator has not been run for this subsection, or the extractor produced no chips.",
        suggestedFix:
          "Regenerate floating numbers for this subsection from the Floating Number page.",
        repairable: false,
      }),
    );
  }

  return issues;
};

/** One-shot end-of-run scan for structural gaps that the step loop can't see. */
export const inspectStructure = (ctrl: PresentationController): Issue[] => {
  const issues: Issue[] = [];
  if (ctrl.beats.length === 0) {
    issues.push({
      id: nextId(),
      kind: "structural",
      section: "root",
      beatId: "",
      lineIdx: null,
      summary: "No beats to present.",
      expected: "at least one beat (cover, intro, or problem)",
      actual: "empty beat list",
      probableCause: "The notebook has no presentable sections.",
      suggestedFix: "Author at least an Introduction or Example section.",
      repairable: false,
      createdAt: Date.now(),
    });
  }
  return issues;
};
