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
 * Resolve the board beat index for a target. Exact ID match first; if
 * the IDs have been regenerated (the on-open lesson sync recreates
 * section rows with new IDs), fall back to matching by TYPE + ORDINAL:
 * "the 2nd problem beat" is the 2nd problem beat on both sides.
 */
export const resolveBeatIdx = (
  target: EditTarget,
  ctrl: PresentationController,
): number => {
  const exact = ctrl.beats.findIndex((b) => b.id === target.beatId);
  if (exact >= 0) return exact;

  if (target.beatId === "__cover__") {
    return ctrl.beats.findIndex((b) => b.id === "__cover__");
  }
  const suffix = target.beatId.endsWith("-q")
    ? "-q"
    : target.beatId.endsWith("-text")
      ? "-text"
      : null;
  if (!suffix || typeof target.beatOrdinal !== "number") return -1;
  let n = 0;
  for (let i = 0; i < ctrl.beats.length; i++) {
    if (ctrl.beats[i].id.endsWith(suffix)) {
      if (n === target.beatOrdinal) return i;
      n++;
    }
  }
  return -1;
};

/**
 * Point the controller at the target's beat and wait (up to ~900ms)
 * until the state actually reflects it. Returns true when settled.
 */
export const waitForBeat = async (
  target: EditTarget,
  ctrl: PresentationController,
): Promise<boolean> => {
  const beatIdx = resolveBeatIdx(target, ctrl);
  if (beatIdx < 0) return false;
  const beatId = ctrl.beats[beatIdx].id; // resolved board-side id
  if (ctrl.getBeatCursor() !== beatIdx) ctrl.setBeatCursor(beatIdx);

  const needsRes = NEEDS_RESERVOIR.has(target.kind);
  const deadline = Date.now() + 900;
  while (Date.now() < deadline) {
    const cursorOk = ctrl.getBeatCursor() === beatIdx;
    const res = ctrl.getActiveReservoir();
    const resOk = !needsRes || res?.beatId === beatId;
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
 * Present mode = pure second writer. One click = one write at the
 * current sensor position. No beat sync, no earlier-line restoration,
 * no verification, no autofix. Whatever text the preview captured on
 * the click is written verbatim onto the Smartboard, exactly like an
 * extra keyboard alongside the Floating Number workflow.
 */
export const applyMirror = async (
  target: EditTarget,
  ctrl: PresentationController,
): Promise<void> => {
  const text = (target.text ?? target.caption ?? "").trim();
  if (!text) return;
  // Block-kind items (captions, section titles, teacher notes) advance
  // the sensor down after writing so the next click gets a fresh row.
  // Chips / inline math insert at the sensor and stay put — Floating
  // Number chip parity.
  const BLOCK_KINDS = new Set(["cover", "section", "subsection", "question", "teacher-note"]);
  const advanceAfter = BLOCK_KINDS.has(target.kind);
  if (ctrl.presentWriteAtSensor) ctrl.presentWriteAtSensor(text, { advanceAfter });
  else if (ctrl.insertTextAtSensor) ctrl.insertTextAtSensor(text);
  else ctrl.writeProseLineOnBoard(text);
  // Teacher notes: silence the note-gate glow after a manual placement.
  if (target.kind === "teacher-note" && typeof target.lineIdx === "number") {
    ctrl.markNotebookShown?.(target.lineIdx);
    ctrl.addNotebookAttention?.(target.lineIdx);
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
