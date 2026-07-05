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
import { nextFreeRow } from "./ledger";
import { planDirectWrite } from "./directWrite";
import { writeNoteOnce } from "./writeNote";

export interface PreviewChannelHost extends BoardWriteHost {
  /** Jump the board to a beat (cover/section/subsection/question). */
  navigateToBeat: (beatId: string, beatOrdinal?: number) => void;
  /** Live chip inserts — byte-identical to tapping the chip in the # panel. */
  insertTextAtSensor?: (text: string) => void;
  insertFractionAtSensor?: (parts: { sign: string; num: string; den: string }) => void;
}

const li = (t: EditTarget): number => (typeof t.lineIdx === "number" ? t.lineIdx : 0);

/** Write a SOLUTION-LINE equation for `lineIdx`. Always writes — no
 *  dedupe. Line 1 and line ∞ take the exact same code path. */
const writeSolutionLine = (
  host: PreviewChannelHost,
  lineIdx: number,
  text: string,
): number | null => {
  const raw = (text ?? "").trim();
  if (!raw) return null;
  const snap = host.getSnapshot();
  const start = nextFreeRow(snap, lineIdx);
  const plan = planDirectWrite(snap, start, raw);
  if (!plan) return null;
  host.commitPlan(plan, { ownerLineIdx: lineIdx, lock: true });
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

    // Teacher note — direct write under the note's own line. Always
    // writes: two clicks write two copies. Undo removes them.
    case "teacher-note": {
      const idx = li(target);
      writeNoteOnce(idx, text, host);
      return;
    }

    // Solution line — direct write of the line's equation text.
    case "solution-line": {
      const idx = li(target);
      writeSolutionLine(host, idx, text);
      return;
    }

    default:
      return;
  }
};
