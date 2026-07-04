// Presentation AI — inspector.
// Compares expected state (from the Preview model) to actual Smartboard state
// pulled through the controller, and emits typed Issues.

import type { PresentationController } from "./controller";
import type { Issue } from "./types";
import { isRenderableNote, type PresentationStep } from "./model";

let idCounter = 0;
const nextId = () => `ai-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

const captionFor = (step: PresentationStep): string =>
  step.kind === "beat"
    ? step.beat.caption ?? step.beat.id
    : step.beat.caption ?? step.beat.id;

interface IssuePatch {
  kind: Issue["kind"];
  summary: string;
  expected: string;
  actual: string;
  probableCause: string;
  suggestedFix: string;
  repairable: boolean;
  lineIdx?: number | null;
  fillerIdx?: number | null;
}

const mkIssue = (step: PresentationStep, patch: IssuePatch): Issue => ({
  id: nextId(),
  createdAt: Date.now(),
  section: captionFor(step),
  beatId: step.beat.id,
  lineIdx:
    patch.lineIdx !== undefined
      ? patch.lineIdx
      : step.kind === "beat"
        ? null
        : step.lineIdx,
  fillerIdx: patch.fillerIdx ?? null,
  kind: patch.kind,
  summary: patch.summary,
  expected: patch.expected,
  actual: patch.actual,
  probableCause: patch.probableCause,
  suggestedFix: patch.suggestedFix,
  repairable: patch.repairable,
});

/** Common beat-cursor / line-cursor sanity checks shared by every step type. */
const checkCursors = (
  step: PresentationStep,
  ctrl: PresentationController,
): Issue[] => {
  const issues: Issue[] = [];
  const cursor = ctrl.getBeatCursor();
  const beat = ctrl.beats[cursor];
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
    return issues;
  }
  if (step.kind !== "beat") {
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
  }
  return issues;
};

export const inspectStep = (
  step: PresentationStep,
  ctrl: PresentationController,
): Issue[] => {
  const issues = checkCursors(step, ctrl);
  if (issues.length > 0) return issues;
  if (step.kind === "beat" || step.kind === "line-start") return issues;

  const line = step.line;

  if (step.kind === "filler") {
    // The board row for this line must now match the expected prefix
    // signature (fillers[0..=fillerIdx]).
    const prefixCount = step.fillerIdx + 1;
    const expected = ctrl.getExpectedPrefixSignatureFor(step.lineIdx, prefixCount);
    const actual = ctrl.getBoardRowSignatureFor(step.lineIdx);
    if (expected && expected !== actual) {
      issues.push(
        mkIssue(step, {
          kind: "filler-missing",
          summary: `Floating Number ${prefixCount} did not land on the Smartboard.`,
          expected: (line.fillers ?? []).slice(0, prefixCount).join(" "),
          actual: actual || "(empty row)",
          probableCause:
            "The AI did not click the chip on the # (Floating Number) panel, or the panel was closed when the chip was picked.",
          suggestedFix: `Open the # panel for line ${step.lineIdx + 1} and click the chip "${(line.fillers ?? [])[step.fillerIdx] ?? ""}".`,
          repairable: true,
          fillerIdx: step.fillerIdx,
        }),
      );
    }
    return issues;
  }

  if (step.kind === "note") {
    const rawNote = (line.notebook ?? "").trim();
    if (!isRenderableNote(rawNote)) return issues;
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
          suggestedFix:
            "Call writeProseLineOnBoard(note) and record the line in shownNotebookIdx.",
          repairable: true,
        }),
      );
      return issues;
    }
    // Even if `shownNotebookIdx` claims the note was placed, verify the
    // Smartboard actually has a row whose ink matches the note. This catches
    // the "flagged shown, never rendered" bug the teacher reported on Line 2.
    const boardHasNote = ctrl.getBoardHasNoteFor?.(step.lineIdx) ?? true;
    if (!boardHasNote) {
      issues.push(
        mkIssue(step, {
          kind: "note-missing-on-board",
          summary: "Presenter Preview shows a Teacher Note but the Smartboard has no matching row.",
          expected: rawNote.slice(0, 120),
          actual: "note row not found on board",
          probableCause:
            "writeProseLineOnBoard ran but the row was overwritten or the note landed on a row already owned by another line.",
          suggestedFix:
            "Move the sensor to a free row for this line and rewrite the note via writeProseLineOnBoard.",
          repairable: true,
        }),
      );
    }
    return issues;
  }

  if (step.kind === "line-verify") {
    // Floating extraction gap — reservoir has no fillers for a non-note line.
    if (!line.notebookOnly && line.equation.trim() && (line.fillers ?? []).length === 0) {
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
    if (!line.notebookOnly) {
      const expected = ctrl.getExpectedRowSignatureFor(step.lineIdx);
      const actual = ctrl.getBoardRowSignatureFor(step.lineIdx);
      if (expected && expected !== actual) {
        issues.push(
          mkIssue(step, {
            kind: "line-mismatch",
            summary: "Completed line on the Smartboard does not match the Presenter Preview.",
            expected: line.equation,
            actual: actual || "(empty row)",
            probableCause:
              "One or more filler placements failed, or the row was overwritten by another effect.",
            suggestedFix: "Rewrite the full equation for this line and re-verify.",
            repairable: true,
          }),
        );
      }
    }
    return issues;
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
