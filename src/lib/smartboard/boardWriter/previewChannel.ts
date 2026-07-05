// PREVIEW CHANNEL — Presenter Preview → Smartboard, one-to-one.
//
// A click on a preview item writes that item straight to the board via
// the shared dumb primitive (planDirectWrite) at the row the ledger
// dictates. No beat-cursor replay, no waiting loops, no verification
// ladders. This channel NEVER calls into the Floating Number channel —
// a bug there cannot replicate here.

import type { EditTarget } from "@/lib/smartboard/manualEdit/types";
import { parseFractionChip } from "@/components/smartboard/FloatingNumberPanel";
import type { BoardWriteHost } from "./host";
import { findTextRow, nextFreeRow } from "./ledger";
import { planDirectWrite } from "./directWrite";

export interface PreviewChannelHost extends BoardWriteHost {
  /** Jump the board to a beat (cover/section/subsection/question). */
  navigateToBeat: (beatId: string, beatOrdinal?: number) => void;
  /** Live chip inserts — byte-identical to tapping the chip in the # panel. */
  insertTextAtSensor?: (text: string) => void;
  insertFractionAtSensor?: (parts: { sign: string; num: string; den: string }) => void;
}

const li = (t: EditTarget): number => (typeof t.lineIdx === "number" ? t.lineIdx : 0);

/** Write `text` for `lineIdx` through the ledger + dumb primitive.
 *  Repeat clicks scroll to the existing ink — never rewrite, never jump. */
const writeLineText = (
  host: PreviewChannelHost,
  lineIdx: number,
  text: string,
  opts: { ownerLineIdx?: number; lock?: boolean },
): number | null => {
  const raw = (text ?? "").trim();
  if (!raw) return null;
  const snap = host.getSnapshot();
  const existing = findTextRow(snap, raw);
  if (existing != null) {
    host.scrollToRow(existing);
    return existing;
  }
  const start = nextFreeRow(snap, lineIdx);
  const plan = planDirectWrite(snap, start, raw);
  if (!plan) return null;
  host.commitPlan(plan, opts);
  host.scrollToRow(plan.rows[0].row);
  return plan.landedRow;
};

/** One preview click → one deterministic board action. */
export const previewWrite = (target: EditTarget, host: PreviewChannelHost): void => {
  const text = (target.text ?? target.caption ?? "").trim();

  switch (target.kind) {
    // Beat navigation — same as pressing Next until the beat is active.
    case "cover":
    case "section":
    case "subsection":
    case "question": {
      if (target.beatId) host.navigateToBeat(target.beatId, target.beatOrdinal);
      return;
    }

    // Chip — live insert at the sensor, exactly like tapping the same
    // chip on the # panel (fraction chips become real stacked fractions).
    case "floating-number": {
      if (!text) return;
      const frac = parseFractionChip(text);
      if (frac && host.insertFractionAtSensor) {
        host.insertFractionAtSensor(frac);
        return;
      }
      const op = /^[+\-−×÷=]/.test(text);
      host.insertTextAtSensor?.(op ? ` ${text} ` : text);
      return;
    }

    // Teacher note — direct write under the note's own line.
    case "teacher-note": {
      const idx = li(target);
      const row = writeLineText(host, idx, text, { lock: true });
      if (row != null) host.markNoteShown?.(idx);
      return;
    }

    // Solution line — direct write of the line's equation text.
    case "solution-line": {
      const idx = li(target);
      writeLineText(host, idx, text, { ownerLineIdx: idx, lock: true });
      return;
    }

    default:
      return;
  }
};
