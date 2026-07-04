// Manual AI Edit — local intent parser + controller driver.
//
// Given a selected EditTarget (from the Presenter Preview) and a plain-
// language prompt from the teacher, we classify the intent with a small
// keyword table and drive the shared PresentationController to bring the
// Smartboard back in sync with the Preview.
//
// This module NEVER mutates the notebook, sections, or Presenter Preview.
// The Preview is the source of truth. All corrections happen on the
// Smartboard side. Where an intent maps onto an existing repair recipe
// (repairs.ts), we reuse it verbatim.

import type { PresentationController } from "@/lib/smartboard/presentationAI/controller";
import type {
  EditTarget,
  EditIntent,
  EditReport,
  EditAction,
} from "./types";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const INTENT_KEYWORDS: { intent: EditIntent; patterns: RegExp[] }[] = [
  { intent: "sync-note", patterns: [/note/i, /teacher note/i] },
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
  // Fallback by target kind.
  switch (target.kind) {
    case "teacher-note":
      return "sync-note";
    case "floating-number":
      return "sync-floating";
    case "solution-line":
      return "sync-line";
    case "question":
      return "sync-line";
    case "math-structure":
      return "rerender-structure";
    default:
      return "unknown";
  }
};

const mkAction = (label: string, ok: boolean, detail?: string): EditAction => ({
  label,
  ok,
  detail,
});

/** Run a manual edit. Returns a report suitable for the drawer footer. */
export const runManualEdit = async (
  target: EditTarget,
  prompt: string,
  ctrl: PresentationController,
): Promise<EditReport> => {
  const intent = classifyIntent(target, prompt);
  const actions: EditAction[] = [];

  const push = (a: EditAction) => actions.push(a);

  // Move the beat cursor to the target's beat so the controller reads the
  // right reservoir when we ask it to write.
  const beatIndex = ctrl.beats.findIndex((b) => b.id === target.beatId);
  if (beatIndex >= 0 && ctrl.getBeatCursor() !== beatIndex) {
    ctrl.setBeatCursor(beatIndex);
    push(mkAction(`Set beat cursor → ${beatIndex}`, true));
    await wait(80);
  }

  const lineIdx = typeof target.lineIdx === "number" ? target.lineIdx : -1;

  try {
    switch (intent) {
      case "fix-scroll": {
        if (lineIdx >= 0) {
          ctrl.scrollBoardTo?.(lineIdx);
          push(mkAction(`Scrolled board to line ${lineIdx + 1}`, true));
        } else {
          const el = ctrl.getPreviewCardEl?.(target.beatId);
          el?.scrollIntoView({ block: "center", behavior: "smooth" });
          push(mkAction("Scrolled preview into view", !!el));
        }
        return { ok: true, intent, message: "Scroll position corrected.", actions };
      }

      case "fix-active-line": {
        if (lineIdx < 0) throw new Error("No line index on target.");
        ctrl.setActiveLineIdx(lineIdx);
        push(mkAction(`Active line → ${lineIdx + 1}`, true));
        return { ok: true, intent, message: "Active line reset.", actions };
      }

      case "sync-note":
      case "move-note": {
        if (lineIdx < 0) throw new Error("Note edit needs a line target.");
        const lines = ctrl.getActiveGuidedLines();
        const raw = (lines[lineIdx]?.notebook ?? "").trim();
        if (!raw) {
          return { ok: false, intent, message: "No teacher note on this line in the Preview.", actions };
        }
        ctrl.scrollBoardTo?.(lineIdx);
        push(mkAction("Scrolled to target line", true));
        ctrl.eraseNoteAt?.(lineIdx);
        push(mkAction("Erased prior note (if any)", true));
        ctrl.setActiveLineIdx(lineIdx);
        ctrl.writeProseLineOnBoard(raw);
        ctrl.markNotebookShown(lineIdx);
        ctrl.addNotebookAttention(lineIdx);
        push(mkAction("Wrote teacher note", true, raw.slice(0, 80)));
        await wait(160);
        const shown = ctrl.getShownNotebookIdx().has(lineIdx);
        const onBoard = ctrl.getBoardHasNoteFor?.(lineIdx) ?? shown;
        return {
          ok: shown && onBoard,
          intent,
          message: shown && onBoard ? "Teacher Note synchronized." : "Note write did not register.",
          actions,
        };
      }

      case "sync-floating": {
        if (lineIdx < 0) throw new Error("Floating edit needs a line target.");
        const fillerIdx =
          typeof target.fillerIdx === "number" ? target.fillerIdx : 0;
        ctrl.scrollBoardTo?.(lineIdx);
        ctrl.moveSensorToSafeRow?.(lineIdx);
        ctrl.openFloatingPanel?.(lineIdx);
        push(mkAction("Opened Floating Number panel", true));
        await wait(80);
        ctrl.pickFloatingNumber?.(lineIdx, fillerIdx);
        push(mkAction(`Picked chip ${fillerIdx + 1}`, true));
        await wait(180);
        const expected = ctrl.getExpectedPrefixSignatureFor(lineIdx, fillerIdx + 1);
        const actual = ctrl.getBoardRowSignatureFor(lineIdx);
        return {
          ok: expected === actual,
          intent,
          message: expected === actual
            ? "Floating number placed."
            : "Chip did not land; try again or use Autoplay repair.",
          actions,
        };
      }

      case "sync-line":
      case "fix-order": {
        if (lineIdx < 0) throw new Error("Line edit needs a line target.");
        const lines = ctrl.getActiveGuidedLines();
        const line = lines[lineIdx];
        if (!line) return { ok: false, intent, message: "Line not in reservoir.", actions };
        ctrl.scrollBoardTo?.(lineIdx);
        ctrl.eraseRow?.(-1, lineIdx);
        ctrl.moveSensorToSafeRow?.(lineIdx);
        push(mkAction("Cleared and re-anchored row", true));
        const fillers = line.fillers ?? [];
        if (target.kind === "question" || lineIdx === 0) {
          const eq = (line.equation ?? "").trim();
          if (eq) {
            if (ctrl.writeQuestionLine) ctrl.writeQuestionLine(lineIdx, eq);
            else ctrl.writeProseLineOnBoard(eq);
            push(mkAction("Wrote question line", true, eq.slice(0, 80)));
          }
        } else if (fillers.length > 0) {
          ctrl.openFloatingPanel?.(lineIdx);
          for (let k = 0; k < fillers.length; k++) {
            ctrl.pickFloatingNumber?.(lineIdx, k);
            await wait(50);
          }
          push(mkAction(`Placed ${fillers.length} chip(s)`, true));
        } else {
          ctrl.writeEquationPrefix(lineIdx, 0);
        }
        await wait(200);
        const expected = ctrl.getExpectedRowSignatureFor(lineIdx);
        const actual = ctrl.getBoardRowSignatureFor(lineIdx);
        return {
          ok: expected === actual,
          intent,
          message: expected === actual ? "Line synchronized with Preview." : "Line still mismatches after rewrite.",
          actions,
        };
      }

      case "fix-overlap": {
        if (lineIdx < 0) throw new Error("Overlap edit needs a line target.");
        ctrl.scrollBoardTo?.(lineIdx);
        ctrl.eraseRow?.(-1, lineIdx);
        const row = ctrl.moveSensorToSafeRow?.(lineIdx);
        push(mkAction(`Moved sensor to safe row${row != null ? ` (${row})` : ""}`, true));
        return { ok: true, intent, message: "Row reseated below overlap.", actions };
      }

      case "fix-spacing": {
        if (lineIdx < 0) throw new Error("Spacing edit needs a line target.");
        ctrl.eraseRow?.(-1, lineIdx);
        ctrl.moveSensorDown?.(1);
        ctrl.moveSensorToSafeRow?.(lineIdx);
        push(mkAction("Reset row spacing", true));
        return { ok: true, intent, message: "Spacing normalised.", actions };
      }

      case "sync-highlight": {
        const beatIndexForHl = ctrl.beats.findIndex((b) => b.id === target.beatId);
        if (beatIndexForHl >= 0) ctrl.setBeatCursor(beatIndexForHl);
        if (lineIdx >= 0) ctrl.setActiveLineIdx(lineIdx);
        push(mkAction("Highlight target reset", true));
        return { ok: true, intent, message: "Highlight resynced.", actions };
      }

      case "sync-structure":
      case "rerender-structure": {
        if (lineIdx < 0) return { ok: false, intent, message: "Select a specific line to re-render.", actions };
        ctrl.eraseRow?.(-1, lineIdx);
        ctrl.moveSensorToSafeRow?.(lineIdx);
        const line = ctrl.getActiveGuidedLines()[lineIdx];
        const eq = (line?.equation ?? "").trim();
        if (eq && ctrl.writeQuestionLine) ctrl.writeQuestionLine(lineIdx, eq);
        else if (eq) ctrl.writeProseLineOnBoard(eq);
        push(mkAction("Re-rendered structure from Preview", true));
        await wait(180);
        const expected = ctrl.getExpectedRowSignatureFor(lineIdx);
        const actual = ctrl.getBoardRowSignatureFor(lineIdx);
        return {
          ok: expected === actual,
          intent,
          message: expected === actual ? "Structure re-rendered." : "Re-render did not match Preview.",
          actions,
        };
      }

      default:
        return {
          ok: false,
          intent,
          message: "I couldn't map that instruction onto a Smartboard action. Try mentioning note, floating, line, spacing, overlap, or scroll.",
          actions,
        };
    }
  } catch (err) {
    return {
      ok: false,
      intent,
      message: (err as Error).message || "Manual edit failed.",
      actions,
    };
  }
};

export const SUGGESTED_PROMPTS: { label: string; prompt: string }[] = [
  { label: "Note missing on board", prompt: "This teacher note did not appear on the Smartboard." },
  { label: "Add floating number", prompt: "This floating number is missing on the Smartboard." },
  { label: "Solution line missing", prompt: "This solution line is missing on the Smartboard." },
  { label: "Fix overlap", prompt: "This equation overlaps the previous equation." },
  { label: "Fix spacing", prompt: "The spacing is incorrect." },
  { label: "Bring into view", prompt: "This line is off screen — scroll it into view." },
  { label: "Reset active line", prompt: "The wrong active line is highlighted." },
  { label: "Re-render structure", prompt: "This mathematical structure is rendered incorrectly." },
];
