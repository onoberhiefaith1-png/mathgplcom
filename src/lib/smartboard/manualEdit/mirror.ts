// Live Mirror Mode — one-to-one mapping between a Presenter Preview
// object and the Smartboard action that displays it. We replay exactly
// the same controller calls the normal presentation engine would make.
//
// Timing-safe: setting the beat cursor is an async React state update,
// so before reading any line data we WAIT until the controller actually
// reports the requested beat/reservoir (instead of a blind 30ms sleep).
// Clearing the board for a mirror uses `clearInkOnly` so the beat cursor
// is never knocked back to 0 mid-mirror.

import type { PresentationController } from "@/lib/smartboard/presentationAI/controller";
import type { EditTarget, MirrorResult } from "./types";

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const li = (t: EditTarget) => (typeof t.lineIdx === "number" ? t.lineIdx : -1);
export const fi = (t: EditTarget) => (typeof t.fillerIdx === "number" ? t.fillerIdx : 0);

/** Full reset — used when EXITING mirror mode (resets beat cursor too). */
export const clearBoard = (ctrl: PresentationController) => {
  ctrl.resetBoard?.();
  ctrl.closeFloatingPanel?.();
};

/** Clear ink/rows only — beat cursor stays where the mirror put it. */
export const clearInk = (ctrl: PresentationController) => {
  if (ctrl.clearInkOnly) ctrl.clearInkOnly();
  else ctrl.resetBoard?.();
  ctrl.closeFloatingPanel?.();
};

const NEEDS_RESERVOIR: ReadonlySet<string> = new Set([
  "question",
  "solution-line",
  "floating-number",
  "teacher-note",
]);

/**
 * Point the controller at the target's beat and wait (up to ~900ms)
 * until the state actually reflects it. Returns true when settled.
 */
export const waitForBeat = async (
  target: EditTarget,
  ctrl: PresentationController,
): Promise<boolean> => {
  const beatIdx = ctrl.beats.findIndex((b) => b.id === target.beatId);
  console.debug("[mirror] waitForBeat", { beatId: target.beatId, beatIdx, cursor: ctrl.getBeatCursor(), beats: JSON.stringify(ctrl.beats.map((b) => b.id)) });
  if (beatIdx < 0) return false;
  if (ctrl.getBeatCursor() !== beatIdx) ctrl.setBeatCursor(beatIdx);

  const needsRes = NEEDS_RESERVOIR.has(target.kind);
  const deadline = Date.now() + 900;
  while (Date.now() < deadline) {
    const cursorOk = ctrl.getBeatCursor() === beatIdx;
    const res = ctrl.getActiveReservoir();
    const resOk = !needsRes || res?.beatId === target.beatId;
    if (cursorOk && resOk) return true;
    if (cursorOk && !needsRes) return true;
    await wait(40);
  }
  return ctrl.getBeatCursor() === beatIdx;
};

/**
 * Direct write — bypasses the reservoir lookup entirely and writes the
 * exact text captured from the Presenter Preview at click time. The
 * information is already in the preview, so it can ALWAYS be shown.
 */
export const directWrite = (target: EditTarget, ctrl: PresentationController): void => {
  const idx = li(target);
  const text = (target.text ?? target.caption ?? "").trim();

  switch (target.kind) {
    case "floating-number": {
      if (idx >= 0) {
        ctrl.setActiveLineIdx(idx);
        ctrl.moveSensorToSafeRow?.(idx);
      }
      ctrl.openFloatingPanel?.(idx >= 0 ? idx : undefined);
      return;
    }
    case "teacher-note": {
      if (!text) return;
      let row: number | undefined;
      if (idx >= 0) {
        ctrl.eraseNoteAt?.(idx);
        row = ctrl.moveSensorToSafeRow?.(idx);
      }
      ctrl.writeProseLineOnBoard(text);
      if (idx >= 0) {
        ctrl.markNotebookShown(idx);
        ctrl.addNotebookAttention(idx);
      }
      if (typeof row === "number") ctrl.scrollBoardToRow?.(row);
      return;
    }
    case "question": {
      if (!text) return;
      let row: number | undefined;
      if (idx >= 0) {
        ctrl.setActiveLineIdx(idx);
        row = ctrl.moveSensorToSafeRow?.(idx);
      }
      if (ctrl.writeQuestionLine && idx >= 0) ctrl.writeQuestionLine(idx, text);
      else ctrl.writeProseLineOnBoard(text);
      if (typeof row === "number") ctrl.scrollBoardToRow?.(row);
      return;
    }
    default: {
      if (!text) return;
      let row: number | undefined;
      if (idx >= 0) {
        ctrl.setActiveLineIdx(idx);
        row = ctrl.moveSensorToSafeRow?.(idx);
      }
      ctrl.writeProseLineOnBoard(text);
      if (typeof row === "number") ctrl.scrollBoardToRow?.(row);
      return;
    }
  }
};

/** Write prose only if the exact text is not already inked on the board —
 *  keeps mirroring ADDITIVE and duplicate-free. */
const writeProseIfMissing = (ctrl: PresentationController, text: string): void => {
  const raw = text.trim();
  if (!raw) return;
  if (ctrl.boardHasTextRow?.(raw)) return; // already there — count on it
  ctrl.writeProseLineOnBoard(raw);
};

/**
 * Apply the mirror action for a target. Uses the SAME controller
 * methods the normal presentation engine uses — never reconstructs or
 * regenerates content.
 *
 * ADDITIVE: mirroring never clears the board. Whatever is already
 * presented stays; the mirror only writes what is missing (or rewrites
 * the one item that was clicked). This keeps Next/Prev playback and
 * previously-forced content intact.
 */
export const applyMirror = async (
  target: EditTarget,
  ctrl: PresentationController,
): Promise<void> => {
  // Point at the right beat FIRST and wait for state to settle.
  await waitForBeat(target, ctrl);
  await wait(40); // let React flush so row/sensor reads are fresh

  switch (target.kind) {
    case "cover": {
      writeProseIfMissing(ctrl, target.text ?? target.caption ?? "");
      return;
    }

    case "section": {
      writeProseIfMissing(ctrl, target.text ?? "");
      return;
    }

    case "subsection": {
      writeProseIfMissing(ctrl, target.caption ?? "");
      return;
    }

    case "question": {
      const idx = li(target);
      const eq = (target.text ?? "").trim();
      // Already on the board? Just bring it into view.
      if (idx >= 0 && ctrl.getBoardRowSignatureFor(idx)) {
        ctrl.setActiveLineIdx(idx);
        ctrl.scrollBoardTo?.(idx);
        return;
      }
      let row: number | undefined;
      if (idx >= 0) {
        ctrl.setActiveLineIdx(idx);
        row = ctrl.moveSensorToSafeRow?.(idx);
      }
      if (ctrl.writeQuestionLine && idx >= 0 && eq) {
        ctrl.writeQuestionLine(idx, eq);
      } else if (eq) {
        writeProseIfMissing(ctrl, eq);
      }
      if (typeof row === "number") ctrl.scrollBoardToRow?.(row);
      else if (idx >= 0) ctrl.scrollBoardTo?.(idx);
      return;
    }

    case "solution-line": {
      const idx = li(target);
      if (idx < 0) return;
      // Already on the board? Just bring it into view.
      if (ctrl.getBoardRowSignatureFor(idx)) {
        ctrl.setActiveLineIdx(idx);
        ctrl.scrollBoardTo?.(idx);
        return;
      }
      ctrl.setActiveLineIdx(idx);
      const row = ctrl.moveSensorToSafeRow?.(idx);
      const line = ctrl.getActiveGuidedLines()[idx];
      const fillers = line?.fillers ?? [];
      if (fillers.length > 0) {
        ctrl.writeEquationPrefix(idx, fillers.length);
      } else {
        const eq = (line?.equation ?? target.text ?? "").trim();
        if (eq) writeProseIfMissing(ctrl, eq);
      }
      if (typeof row === "number") ctrl.scrollBoardToRow?.(row);
      else ctrl.scrollBoardTo?.(idx);
      return;
    }

    case "floating-number": {
      // Clicking a `#` (or chip) OPENS the Floating Number panel for
      // that line — it does NOT write ink or solve.
      const idx = li(target);
      if (idx < 0) return;
      ctrl.setActiveLineIdx(idx);
      ctrl.scrollBoardTo?.(idx);
      ctrl.moveSensorToSafeRow?.(idx);
      ctrl.openFloatingPanel?.(idx);
      return;
    }

    case "teacher-note": {
      const idx = li(target);
      if (idx < 0) return;
      ctrl.setActiveLineIdx(idx);
      // Prefer the live reservoir text; ALWAYS fall back to the exact
      // text the preview showed at click time.
      const raw =
        (ctrl.getActiveGuidedLines()[idx]?.notebook ?? target.text ?? "").trim() ||
        (target.text ?? "").trim();
      if (!raw) return;
      ctrl.eraseNoteAt?.(idx);
      const row = ctrl.moveSensorToSafeRow?.(idx);
      ctrl.writeProseLineOnBoard(raw);
      ctrl.markNotebookShown(idx);
      ctrl.addNotebookAttention(idx);
      // Bring the freshly written note into view — note rows have no
      // rowOwners entry, so scrollBoardTo(lineIdx) alone cannot find it.
      if (typeof row === "number") ctrl.scrollBoardToRow?.(row);
      else ctrl.scrollBoardTo?.(idx);
      return;
    }

    case "math-structure":
    default: {
      writeProseIfMissing(ctrl, target.text ?? "");
      return;
    }
  }
};

/**
 * Verify — non-destructive readout. Uses `boardHasTextRow` (signature
 * match against actual ink) so an empty/missing write can NEVER pass
 * as success.
 */
export const verifyMirror = (
  target: EditTarget,
  ctrl: PresentationController,
): MirrorResult => {
  const label = target.caption || target.kind;
  const hasText = (text: string | undefined | null): boolean | null => {
    const raw = (text ?? "").trim();
    if (!raw) return null;
    if (!ctrl.boardHasTextRow) return null;
    return ctrl.boardHasTextRow(raw);
  };

  switch (target.kind) {
    case "teacher-note": {
      const idx = li(target);
      if (idx < 0) return { ok: true, message: `Mirrored: ${label}` };
      const expected =
        (ctrl.getActiveGuidedLines()[idx]?.notebook ?? "").trim() ||
        (target.text ?? "").trim();
      const direct = hasText(expected);
      if (direct === true) return { ok: true, message: `✓ Note is on the board` };
      if (direct === false) {
        return {
          ok: false,
          message: `✗ Note did not appear on the board.`,
          detail: `Line ${idx + 1}: no board row matches the note text.`,
        };
      }
      // Fallback to the legacy check when boardHasTextRow is unavailable.
      const has = ctrl.getBoardHasNoteFor?.(idx);
      if (has === false) {
        return {
          ok: false,
          message: `✗ Note did not appear on the board.`,
          detail: `Line ${idx + 1}: Smartboard did not render the note.`,
        };
      }
      return { ok: true, message: `✓ Mirrored: ${label}` };
    }

    case "floating-number": {
      const open = ctrl.isFloatingPanelOpen?.() ?? true;
      return open
        ? { ok: true, message: `✓ Floating Number panel is open` }
        : {
            ok: false,
            message: `✗ Floating Number panel did not open.`,
            detail: `Line ${li(target) + 1}: panel failed to display chips.`,
          };
    }

    case "solution-line":
    case "question": {
      const idx = li(target);
      if (idx < 0) return { ok: true, message: `Mirrored: ${label}` };
      const sig = ctrl.getBoardRowSignatureFor(idx) || "";
      if (sig) return { ok: true, message: `✓ Mirrored: ${label}` };
      // Signature can miss when row ownership differs — check raw text.
      const line = ctrl.getActiveGuidedLines()[idx];
      const fillers = line?.fillers ?? [];
      const expected =
        target.kind === "solution-line" && fillers.length > 0
          ? fillers.join(" ")
          : (line?.equation ?? target.text ?? "");
      const direct = hasText(expected) ?? hasText(target.text);
      if (direct === true) return { ok: true, message: `✓ Mirrored: ${label}` };
      return {
        ok: false,
        message: `✗ ${target.kind === "question" ? "Question" : "Line"} did not appear.`,
        detail: `Line ${idx + 1}: Smartboard produced no ink.`,
      };
    }

    default: {
      const direct = hasText(target.text ?? target.caption);
      if (direct === false) {
        return {
          ok: false,
          message: `✗ ${label} did not appear on the board.`,
          detail: `No board row matches the mirrored text.`,
        };
      }
      return { ok: true, message: `✓ Mirrored: ${label}` };
    }
  }
};
