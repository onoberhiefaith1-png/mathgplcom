// Presentation AI — repair recipes.
// Each recipe knows how to fix one issue kind by driving the controller.
// Repairs are bounded and safe: they only manipulate cursor/reveal state,
// never lesson content, floating extraction, or persisted data.

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
      if (step.kind !== "line") return { ok: false, message: "Not a line step." };
      ctrl.setActiveLineIdx(step.lineIdx);
      await wait(120);
      return ctrl.getActiveLineIdx() === step.lineIdx
        ? { ok: true, message: "Line cursor resynced." }
        : { ok: false, message: "Line cursor did not accept the new value." };
    }
    case "note-missing": {
      if (step.kind !== "line") return { ok: false, message: "Not a line step." };
      const raw = (step.line.notebook ?? "").trim();
      if (!raw) return { ok: false, message: "No note text available." };
      ctrl.writeProseLineOnBoard(raw);
      ctrl.markNotebookShown(step.lineIdx);
      ctrl.addNotebookAttention(step.lineIdx);
      await wait(120);
      return ctrl.getShownNotebookIdx().has(step.lineIdx)
        ? { ok: true, message: "Teacher Note written to the board." }
        : { ok: false, message: "Note write did not register." };
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
      if (step.kind === "line") ctrl.setActiveLineIdx(step.lineIdx);
      await wait(120);
      return { ok: true, message: "Highlight target reset." };
    }
    default:
      return { ok: false, message: "This issue type must be fixed by a code change." };
  }
};

export const isRepairable = (issue: Issue): boolean => issue.repairable;
