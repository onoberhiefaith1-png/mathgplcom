// Live Mirror Mode — one-to-one mapping between a Presenter Preview
// object and the Smartboard action that displays it. No diagnosis, no
// repair, no regeneration: we replay exactly the same controller call
// the normal presentation engine would make.
//
// If a mapping produces nothing (`verify` returns ok:false), the caller
// surfaces that as a "mapping broken" badge in the UI — we never try to
// fix it here.

import type { PresentationController } from "@/lib/smartboard/presentationAI/controller";
import type { EditTarget, MirrorResult } from "./types";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const li = (t: EditTarget) => (typeof t.lineIdx === "number" ? t.lineIdx : -1);
const fi = (t: EditTarget) => (typeof t.fillerIdx === "number" ? t.fillerIdx : 0);

/** Clear every mark from the Smartboard so mirror mode starts blank. */
export const clearBoard = (ctrl: PresentationController) => {
  ctrl.resetBoard?.();
  ctrl.closeFloatingPanel?.();
};

/**
 * Apply the mirror action for a target. Uses the SAME controller
 * methods the normal presentation engine uses — never reconstructs or
 * regenerates content.
 */
export const applyMirror = async (
  target: EditTarget,
  ctrl: PresentationController,
): Promise<void> => {
  // Always start from a blank canvas so mirroring is deterministic.
  clearBoard(ctrl);
  await wait(30);

  switch (target.kind) {
    case "cover": {
      const text = (target.text ?? target.caption ?? "").trim();
      if (text) ctrl.writeProseLineOnBoard(text);
      return;
    }

    case "section": {
      const text = (target.text ?? "").trim();
      if (text) ctrl.writeProseLineOnBoard(text);
      return;
    }

    case "subsection": {
      // Heading only — the question line handles its own selection.
      const text = (target.caption ?? "").trim();
      if (text) ctrl.writeProseLineOnBoard(text);
      return;
    }

    case "question": {
      const idx = li(target);
      const eq = (target.text ?? "").trim();
      // Position the sensor + set the active beat/line the same way
      // normal playback does before writing the question line.
      const beatIdx = ctrl.beats.findIndex((b) => b.id === target.beatId);
      if (beatIdx >= 0) ctrl.setBeatCursor(beatIdx);
      if (idx >= 0) {
        ctrl.setActiveLineIdx(idx);
        ctrl.scrollBoardTo?.(idx);
        ctrl.moveSensorToSafeRow?.(idx);
      }
      if (ctrl.writeQuestionLine && idx >= 0 && eq) {
        ctrl.writeQuestionLine(idx, eq);
      } else if (eq) {
        ctrl.writeProseLineOnBoard(eq);
      }
      return;
    }

    case "solution-line": {
      const idx = li(target);
      if (idx < 0) return;
      const beatIdx = ctrl.beats.findIndex((b) => b.id === target.beatId);
      if (beatIdx >= 0) ctrl.setBeatCursor(beatIdx);
      ctrl.setActiveLineIdx(idx);
      ctrl.scrollBoardTo?.(idx);
      ctrl.moveSensorToSafeRow?.(idx);
      const line = ctrl.getActiveGuidedLines()[idx];
      const fillers = line?.fillers ?? [];
      if (fillers.length > 0) {
        ctrl.writeEquationPrefix(idx, fillers.length);
      } else {
        const eq = (line?.equation ?? target.text ?? "").trim();
        if (eq) ctrl.writeProseLineOnBoard(eq);
      }
      return;
    }

    case "floating-number": {
      const idx = li(target);
      const k = fi(target);
      if (idx < 0) return;
      const beatIdx = ctrl.beats.findIndex((b) => b.id === target.beatId);
      if (beatIdx >= 0) ctrl.setBeatCursor(beatIdx);
      ctrl.setActiveLineIdx(idx);
      ctrl.scrollBoardTo?.(idx);
      ctrl.moveSensorToSafeRow?.(idx);
      // Same call the normal presenter uses when a teacher taps a chip.
      if (ctrl.pickFloatingNumber) {
        ctrl.pickFloatingNumber(idx, k);
      } else {
        ctrl.writeEquationPrefix(idx, k + 1);
      }
      return;
    }

    case "teacher-note": {
      const idx = li(target);
      if (idx < 0) return;
      const beatIdx = ctrl.beats.findIndex((b) => b.id === target.beatId);
      if (beatIdx >= 0) ctrl.setBeatCursor(beatIdx);
      ctrl.setActiveLineIdx(idx);
      ctrl.scrollBoardTo?.(idx);
      const raw =
        (ctrl.getActiveGuidedLines()[idx]?.notebook ?? target.text ?? "").trim();
      if (!raw) return;
      // Same sequence normal playback runs when a note beat fires.
      ctrl.eraseNoteAt?.(idx);
      ctrl.moveSensorToSafeRow?.(idx);
      ctrl.writeProseLineOnBoard(raw);
      ctrl.markNotebookShown(idx);
      ctrl.addNotebookAttention(idx);
      return;
    }

    case "math-structure":
    default: {
      const text = (target.text ?? "").trim();
      if (text) ctrl.writeProseLineOnBoard(text);
      return;
    }
  }
};

/**
 * Verify — a single, non-destructive readout. Returns ok:false with a
 * "mapping broken" message when the Smartboard produced nothing.
 */
export const verifyMirror = (
  target: EditTarget,
  ctrl: PresentationController,
): MirrorResult => {
  const label = target.caption || target.kind;
  switch (target.kind) {
    case "teacher-note": {
      const idx = li(target);
      if (idx < 0) return { ok: true, message: `Mirrored: ${label}` };
      const has = ctrl.getBoardHasNoteFor?.(idx);
      if (has === false) {
        return {
          ok: false,
          message: `✗ Mapping for Teacher Note is broken.`,
          detail: `Line ${idx + 1}: Smartboard did not render the note.`,
        };
      }
      return { ok: true, message: `✓ Mirrored: ${label}` };
    }
    case "solution-line":
    case "question":
    case "floating-number": {
      const idx = li(target);
      if (idx < 0) return { ok: true, message: `Mirrored: ${label}` };
      const sig = ctrl.getBoardRowSignatureFor(idx) || "";
      if (!sig) {
        return {
          ok: false,
          message: `✗ Mapping for ${target.kind} is broken.`,
          detail: `Line ${idx + 1}: Smartboard produced no ink.`,
        };
      }
      return { ok: true, message: `✓ Mirrored: ${label}` };
    }
    default:
      return { ok: true, message: `✓ Mirrored: ${label}` };
  }
};
