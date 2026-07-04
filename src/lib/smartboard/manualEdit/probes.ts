// Manual AI Edit — probes. Pure read functions that measure the board
// against the Presenter Preview. Probes never write to the board.

import type { PresentationController } from "@/lib/smartboard/presentationAI/controller";
import type { EditTarget } from "./types";

export interface NoteProbe {
  inPreview: boolean;
  onBoard: boolean;
  text: string;
}

export interface LineProbe {
  hasLine: boolean;
  matches: boolean;
  expected: string;
  actual: string;
}

export interface FloatingProbe {
  matches: boolean;
  panelOpen: boolean;
  expected: string;
  actual: string;
}

export interface ScrollProbe {
  inView: boolean;
}

export interface ActiveLineProbe {
  matches: boolean;
  active: number;
}

export const probeNote = (
  ctrl: PresentationController,
  lineIdx: number,
): NoteProbe => {
  const lines = ctrl.getActiveGuidedLines();
  const raw = (lines[lineIdx]?.notebook ?? "").trim();
  const inPreview = raw.length > 0;
  const shown = ctrl.getShownNotebookIdx().has(lineIdx);
  const onBoard = ctrl.getBoardHasNoteFor?.(lineIdx) ?? shown;
  return { inPreview, onBoard, text: raw };
};

export const probeLine = (
  ctrl: PresentationController,
  lineIdx: number,
): LineProbe => {
  const expected = ctrl.getExpectedRowSignatureFor(lineIdx);
  const actual = ctrl.getBoardRowSignatureFor(lineIdx);
  return {
    hasLine: actual.length > 0,
    matches: expected === actual && expected.length > 0,
    expected,
    actual,
  };
};

export const probeFloating = (
  ctrl: PresentationController,
  lineIdx: number,
  fillerIdx: number,
): FloatingProbe => {
  const expected = ctrl.getExpectedPrefixSignatureFor(lineIdx, fillerIdx + 1);
  const actual = ctrl.getBoardRowSignatureFor(lineIdx);
  return {
    matches: expected === actual && expected.length > 0,
    panelOpen: ctrl.isFloatingPanelOpen?.() ?? false,
    expected,
    actual,
  };
};

export const probeScroll = (
  ctrl: PresentationController,
  target: EditTarget,
): ScrollProbe => {
  const el = ctrl.getPreviewCardEl?.(target.beatId);
  if (!el) return { inView: true };
  const rect = el.getBoundingClientRect();
  const inView =
    rect.top >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);
  return { inView };
};

export const probeActiveLine = (
  ctrl: PresentationController,
  lineIdx: number,
): ActiveLineProbe => {
  const active = ctrl.getActiveLineIdx();
  return { matches: active === lineIdx, active };
};

export const probeOverlap = (
  ctrl: PresentationController,
  lineIdx: number,
): { overlaps: boolean; with: number | null } => {
  const o = ctrl.detectOverlap?.(lineIdx);
  return { overlaps: !!o?.overlapsWith && o.overlapsWith !== null, with: o?.overlapsWith ?? null };
};
