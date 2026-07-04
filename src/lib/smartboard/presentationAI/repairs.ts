// Presentation AI — repair recipes.
// Each recipe knows how to fix one issue kind by driving the controller.
// Repairs are bounded and safe: they only manipulate cursor/reveal state and
// invoke the teacher-style equation writer — never lesson content, floating
// extraction, or persisted data.

import type { PresentationController } from "./controller";
import type { Issue } from "./types";
import type { PresentationStep } from "./model";

export interface RepairResult {
  ok: boolean;
  message: string;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const runRepair = async (
  issue: Issue,
  step: PresentationStep,
  ctrl: PresentationController,
): Promise<RepairResult> => {
  switch (issue.kind) {
    case "beat-cursor-drift": {
      ctrl.setBeatCursor(step.beatIndex);
      await wait(120);
      const now = ctrl.getBeatCursor();
      return now === step.beatIndex
        ? { ok: true, message: "Beat cursor resynced." }
        : { ok: false, message: "Beat cursor did not accept the new value." };
    }
    case "line-cursor-drift": {
      if (step.kind === "beat") return { ok: false, message: "Not a line step." };
      ctrl.setActiveLineIdx(step.lineIdx);
      await wait(120);
      return ctrl.getActiveLineIdx() === step.lineIdx
        ? { ok: true, message: "Line cursor resynced." }
        : { ok: false, message: "Line cursor did not accept the new value." };
    }
    case "filler-missing": {
      if (step.kind !== "filler") return { ok: false, message: "Not a filler step." };
      // Teacher move (Rule 2 → 3 → 5 → 6): scroll target into view, seat
      // the sensor on a safe row, open the # panel, then click the chip.
      ctrl.scrollBoardTo?.(step.lineIdx);
      ctrl.moveSensorToSafeRow?.(step.lineIdx);
      ctrl.openFloatingPanel?.(step.lineIdx);
      await wait(80);
      if (ctrl.pickFloatingNumber) ctrl.pickFloatingNumber(step.lineIdx, step.fillerIdx);
      else ctrl.writeEquationPrefix(step.lineIdx, step.fillerIdx + 1);
      await wait(200);
      const prefix = step.fillerIdx + 1;
      let expected = ctrl.getExpectedPrefixSignatureFor(step.lineIdx, prefix);
      let actual = ctrl.getBoardRowSignatureFor(step.lineIdx);
      if (expected !== actual) {
        // Rule 6: erase and retry once on a fresh safe row.
        ctrl.eraseRow?.(-1, step.lineIdx);
        ctrl.moveSensorToSafeRow?.(step.lineIdx);
        for (let k = 0; k <= step.fillerIdx; k++) {
          ctrl.pickFloatingNumber?.(step.lineIdx, k);
          await wait(60);
        }
        await wait(120);
        expected = ctrl.getExpectedPrefixSignatureFor(step.lineIdx, prefix);
        actual = ctrl.getBoardRowSignatureFor(step.lineIdx);
      }
      return expected === actual
        ? { ok: true, message: `Floating Number ${prefix} placed via the # panel.` }
        : { ok: false, message: "Row did not accept the chip. The AI must open the # panel and click the chip manually." };
    }
    case "question-line-missing": {
      if (step.kind === "beat") return { ok: false, message: "Not a line step." };
      const eq = (step.line.equation ?? "").trim();
      if (!eq) return { ok: false, message: "No equation text for the question line." };
      ctrl.scrollBoardTo?.(step.lineIdx);
      ctrl.moveSensorToSafeRow?.(step.lineIdx);
      if (ctrl.writeQuestionLine) ctrl.writeQuestionLine(step.lineIdx, eq);
      else ctrl.writeProseLineOnBoard(eq);
      await wait(180);
      const expected = ctrl.getExpectedRowSignatureFor(step.lineIdx);
      const actual = ctrl.getBoardRowSignatureFor(step.lineIdx);
      return expected === actual
        ? { ok: true, message: "Question line written." }
        : { ok: false, message: "Question line did not land on the board." };
    }
    case "line-mismatch": {
      if (step.kind === "beat") return { ok: false, message: "Not a line step." };
      // Rule 8: erase current row, safe-row, rewrite full equation.
      ctrl.eraseRow?.(-1, step.lineIdx);
      ctrl.moveSensorToSafeRow?.(step.lineIdx);
      const fillers = step.line.fillers ?? [];
      if (fillers.length > 0) {
        for (let k = 0; k < fillers.length; k++) {
          ctrl.pickFloatingNumber?.(step.lineIdx, k);
          await wait(40);
        }
      } else {
        ctrl.writeEquationPrefix(step.lineIdx, fillers.length);
      }
      await wait(200);
      const expected = ctrl.getExpectedRowSignatureFor(step.lineIdx);
      const actual = ctrl.getBoardRowSignatureFor(step.lineIdx);
      return expected === actual
        ? { ok: true, message: "Line rewritten from the Presenter Preview." }
        : { ok: false, message: "Line still does not match after rewrite." };
    }
    case "note-missing":
    case "note-missing-on-board": {
      if (step.kind === "beat") return { ok: false, message: "Not a line step." };
      const raw = (step.line.notebook ?? "").trim();
      if (!raw) return { ok: false, message: "No note text available." };
      // Teacher move: scroll target line into view, erase any half-written
      // note that may have overlapped, then write the note fresh.
      ctrl.scrollBoardTo?.(step.lineIdx);
      ctrl.eraseNoteAt?.(step.lineIdx);
      ctrl.writeProseLineOnBoard(raw);
      ctrl.markNotebookShown(step.lineIdx);
      ctrl.addNotebookAttention(step.lineIdx);
      await wait(180);
      const shown = ctrl.getShownNotebookIdx().has(step.lineIdx);
      const onBoard = ctrl.getBoardHasNoteFor?.(step.lineIdx) ?? shown;
      return shown && onBoard
        ? { ok: true, message: "Teacher Note written to the board." }
        : { ok: false, message: "Note write did not register on the board." };
    }
    case "overlap-detected":
    case "sensor-misplaced": {
      if (step.kind === "beat") return { ok: false, message: "Not a line step." };
      ctrl.scrollBoardTo?.(step.lineIdx);
      ctrl.setActiveLineIdx(step.lineIdx);
      await wait(120);
      return { ok: true, message: "Sensor re-anchored on target line." };
    }
    case "scroll-out-of-view": {
      const el = ctrl.getPreviewCardEl?.(step.beat.id);
      if (!el) return { ok: false, message: "Preview card not mounted." };
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      await wait(200);
      return { ok: true, message: "Scrolled preview into view." };
    }
    case "highlight-wrong": {
      ctrl.setBeatCursor(step.beatIndex);
      if (step.kind !== "beat") ctrl.setActiveLineIdx(step.lineIdx);
      await wait(120);
      return { ok: true, message: "Highlight target reset." };
    }
    default:
      return { ok: false, message: "This issue type must be fixed by a code change." };
  }
};

export const isRepairable = (issue: Issue): boolean => issue.repairable;
