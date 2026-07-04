// Pipeline tactics — invasive repair moves for the AI Operator.
//
// These sit *around* the normal click/render pipeline, not inside it.
// When the plain "click the note" path fails, we escalate: synthesize DOM
// clicks, side-door the controller writers, erase + reinject, rebuild
// row ownership, force repaint. The goal is that anything present in the
// Presenter Preview lands on the Smartboard even if the normal handler
// is silently broken.

import type { PresentationController } from "@/lib/smartboard/presentationAI/controller";
import type { EditTarget } from "./types";
import * as G from "./gestures";
import type { Tactic } from "./strategies";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const li = (t: EditTarget) => (typeof t.lineIdx === "number" ? t.lineIdx : -1);
const fi = (t: EditTarget) => (typeof t.fillerIdx === "number" ? t.fillerIdx : 0);

const noteTextFor = (ctrl: PresentationController, lineIdx: number): string => {
  const lines = ctrl.getActiveGuidedLines();
  return (lines[lineIdx]?.notebook ?? "").trim();
};

const syntheticClick = (el: Element | null | undefined): boolean => {
  if (!el) return false;
  try {
    const ev = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    el.dispatchEvent(ev);
    return true;
  } catch {
    return false;
  }
};

const findNoteButton = (ctrl: PresentationController, lineIdx: number): HTMLElement | null => {
  if (ctrl.getNoteButtonEl) return ctrl.getNoteButtonEl(lineIdx);
  return (
    (document.querySelector(
      `[data-note-button][data-line-idx="${lineIdx}"]`,
    ) as HTMLElement | null) || null
  );
};

const findHashFab = (ctrl: PresentationController): HTMLElement | null => {
  if (ctrl.getHashFabEl) return ctrl.getHashFabEl();
  return (
    (document.querySelector(`[data-fab="hash"]`) as HTMLElement | null) || null
  );
};

const findChipEl = (
  ctrl: PresentationController,
  lineIdx: number,
  fillerIdx: number,
): HTMLElement | null => {
  if (ctrl.getChipEl) return ctrl.getChipEl(lineIdx, fillerIdx);
  return (
    (document.querySelector(
      `[data-chip][data-line-idx="${lineIdx}"][data-filler-idx="${fillerIdx}"]`,
    ) as HTMLElement | null) || null
  );
};

/* ── Note tactics (Line-1-not-clickable case) ─────────────────────── */

export const noteTactics: Tactic[] = [
  {
    name: "Replay note via controller",
    run: async (ctrl, t) => {
      const raw = noteTextFor(ctrl, li(t));
      if (raw) await G.clickNote(ctrl, li(t), raw);
    },
  },
  {
    name: "Synthetic DOM click on note pill",
    run: async (ctrl, t) => {
      const el = findNoteButton(ctrl, li(t));
      syntheticClick(el);
      await wait(180);
    },
  },
  {
    name: "Side-door: write note directly on the board",
    run: async (ctrl, t) => {
      const idx = li(t);
      const raw = noteTextFor(ctrl, idx);
      if (!raw) return;
      ctrl.scrollBoardTo?.(idx);
      ctrl.moveSensorToSafeRow?.(idx);
      ctrl.writeProseLineOnBoard(raw);
      ctrl.markNotebookShown(idx);
      ctrl.addNotebookAttention(idx);
      await wait(200);
    },
  },
  {
    name: "Erase + re-inject note",
    run: async (ctrl, t) => {
      const idx = li(t);
      const raw = noteTextFor(ctrl, idx);
      if (!raw) return;
      ctrl.eraseNoteAt?.(idx);
      await wait(80);
      ctrl.scrollBoardTo?.(idx);
      ctrl.moveSensorToSafeRow?.(idx);
      ctrl.writeProseLineOnBoard(raw);
      ctrl.markNotebookShown(idx);
      ctrl.addNotebookAttention(idx);
      await wait(200);
    },
  },
  {
    name: "Rebuild row ownership then re-inject",
    run: async (ctrl, t) => {
      const idx = li(t);
      ctrl.rebuildRowOwnership?.(idx);
      await wait(80);
      const raw = noteTextFor(ctrl, idx);
      if (raw) {
        ctrl.moveSensorToSafeRow?.(idx);
        ctrl.writeProseLineOnBoard(raw);
        ctrl.markNotebookShown(idx);
      }
      await wait(200);
    },
  },
  {
    name: "Force repaint row + re-inject",
    run: async (ctrl, t) => {
      const idx = li(t);
      ctrl.forceRepaintLine?.(idx);
      await wait(120);
      const raw = noteTextFor(ctrl, idx);
      if (raw) {
        ctrl.moveSensorToSafeRow?.(idx);
        ctrl.writeProseLineOnBoard(raw);
        ctrl.markNotebookShown(idx);
        ctrl.addNotebookAttention(idx);
      }
      await wait(220);
    },
  },
];

/* ── Chip tactics ─────────────────────────────────────────────────── */

export const chipTactics: Tactic[] = [
  {
    name: "Replay chip via controller",
    run: async (ctrl, t) => {
      await G.clickHash(ctrl, li(t));
      await G.pickChip(ctrl, li(t), fi(t));
    },
  },
  {
    name: "Synthetic click on # FAB then chip tile",
    run: async (ctrl, t) => {
      const fab = findHashFab(ctrl);
      syntheticClick(fab);
      await wait(120);
      const chip = findChipEl(ctrl, li(t), fi(t));
      syntheticClick(chip);
      await wait(160);
    },
  },
  {
    name: "Erase row, replay chips 0..k via panel",
    run: async (ctrl, t) => {
      const idx = li(t);
      const k = fi(t);
      await G.eraseLineRow(ctrl, idx);
      ctrl.moveSensorToSafeRow?.(idx);
      await G.clickHash(ctrl, idx);
      for (let i = 0; i <= k; i++) await G.pickChip(ctrl, idx, i);
      ctrl.closeFloatingPanel?.();
    },
  },
  {
    name: "Bypass panel: writeEquationPrefix",
    run: async (ctrl, t) => {
      ctrl.writeEquationPrefix(li(t), fi(t) + 1);
      await wait(180);
    },
  },
  {
    name: "Force repaint row + rewrite fresh",
    run: async (ctrl, t) => {
      const idx = li(t);
      ctrl.forceRepaintLine?.(idx);
      await wait(120);
      ctrl.moveSensorToSafeRow?.(idx);
      ctrl.writeEquationPrefix(idx, fi(t) + 1);
      await wait(220);
    },
  },
];

/* ── Line / question tactics ──────────────────────────────────────── */

export const lineTactics: Tactic[] = [
  {
    name: "Rewrite line from scratch",
    run: async (ctrl, t) => G.retryLineFromScratch(ctrl, li(t)),
  },
  {
    name: "Scroll + reset active line + rewrite",
    run: async (ctrl, t) => {
      const idx = li(t);
      await G.scrollIntoView(ctrl, idx);
      await G.resetActiveLine(ctrl, idx);
      await G.retryLineFromScratch(ctrl, idx);
    },
  },
  {
    name: "Rebuild row ownership + rewrite",
    run: async (ctrl, t) => {
      const idx = li(t);
      ctrl.rebuildRowOwnership?.(idx);
      await wait(80);
      await G.retryLineFromScratch(ctrl, idx);
    },
  },
  {
    name: "Force repaint row + rewrite",
    run: async (ctrl, t) => {
      const idx = li(t);
      ctrl.forceRepaintLine?.(idx);
      await wait(120);
      await G.retryLineFromScratch(ctrl, idx);
    },
  },
];

/* ── Universal fallbacks ──────────────────────────────────────────── */

export const universalTactics: Tactic[] = [
  {
    name: "Reset beat cursor + active line",
    run: async (ctrl, t) => {
      await G.resetBeatCursor(ctrl, t.beatId);
      const idx = li(t);
      if (idx >= 0) await G.resetActiveLine(ctrl, idx);
    },
  },
  {
    name: "Scroll board + preview into view",
    run: async (ctrl, t) => {
      const idx = li(t);
      if (idx >= 0) await G.scrollIntoView(ctrl, idx);
      ctrl.getPreviewCardEl?.(t.beatId)?.scrollIntoView({ block: "center", behavior: "smooth" });
      await wait(160);
    },
  },
];

export const pipelineLadderFor = (target: EditTarget): Tactic[] => {
  switch (target.kind) {
    case "teacher-note":
      return [...noteTactics, ...universalTactics];
    case "floating-number":
      return [...chipTactics, ...universalTactics];
    case "solution-line":
    case "question":
    case "math-structure":
      return [...lineTactics, ...universalTactics];
    default:
      return [...universalTactics];
  }
};
