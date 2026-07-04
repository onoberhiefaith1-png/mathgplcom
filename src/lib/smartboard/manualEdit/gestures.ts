// Manual AI Edit — gestures. Teacher-style actions on the Smartboard.
// Each gesture performs the same sequence a human hand would follow.
// Gestures never mutate Preview or notebook data.

import type { PresentationController } from "@/lib/smartboard/presentationAI/controller";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const scrollIntoView = async (
  ctrl: PresentationController,
  lineIdx: number,
) => {
  ctrl.scrollBoardTo?.(lineIdx);
  await wait(180);
};

export const clickNote = async (
  ctrl: PresentationController,
  lineIdx: number,
  text: string,
) => {
  ctrl.scrollBoardTo?.(lineIdx);
  ctrl.setActiveLineIdx(lineIdx);
  ctrl.eraseNoteAt?.(lineIdx);
  ctrl.moveSensorToSafeRow?.(lineIdx);
  ctrl.writeProseLineOnBoard(text);
  ctrl.markNotebookShown(lineIdx);
  ctrl.addNotebookAttention(lineIdx);
  await wait(200);
};

export const clickHash = async (
  ctrl: PresentationController,
  lineIdx: number,
) => {
  ctrl.scrollBoardTo?.(lineIdx);
  ctrl.moveSensorToSafeRow?.(lineIdx);
  ctrl.openFloatingPanel?.(lineIdx);
  await wait(120);
};

export const pickChip = async (
  ctrl: PresentationController,
  lineIdx: number,
  fillerIdx: number,
) => {
  if (ctrl.pickFloatingNumber) ctrl.pickFloatingNumber(lineIdx, fillerIdx);
  else ctrl.writeEquationPrefix(lineIdx, fillerIdx + 1);
  await wait(120);
};

export const writeQuestion = async (
  ctrl: PresentationController,
  lineIdx: number,
  eq: string,
) => {
  ctrl.scrollBoardTo?.(lineIdx);
  ctrl.moveSensorToSafeRow?.(lineIdx);
  if (ctrl.writeQuestionLine) ctrl.writeQuestionLine(lineIdx, eq);
  else ctrl.writeProseLineOnBoard(eq);
  await wait(180);
};

export const eraseLineRow = async (
  ctrl: PresentationController,
  lineIdx: number,
) => {
  ctrl.eraseRow?.(-1, lineIdx);
  await wait(100);
};

export const retryLineFromScratch = async (
  ctrl: PresentationController,
  lineIdx: number,
) => {
  const lines = ctrl.getActiveGuidedLines();
  const line = lines[lineIdx];
  if (!line) return;
  await eraseLineRow(ctrl, lineIdx);
  ctrl.moveSensorToSafeRow?.(lineIdx);
  const fillers = line.fillers ?? [];
  if (lineIdx === 0 || fillers.length === 0) {
    const eq = (line.equation ?? "").trim();
    if (eq) await writeQuestion(ctrl, lineIdx, eq);
  } else {
    await clickHash(ctrl, lineIdx);
    for (let k = 0; k < fillers.length; k++) {
      await pickChip(ctrl, lineIdx, k);
    }
    ctrl.closeFloatingPanel?.();
  }
  await wait(180);
};

export const resetActiveLine = async (
  ctrl: PresentationController,
  lineIdx: number,
) => {
  ctrl.setActiveLineIdx(lineIdx);
  await wait(80);
};

export const resetBeatCursor = async (
  ctrl: PresentationController,
  beatId: string,
) => {
  const i = ctrl.beats.findIndex((b) => b.id === beatId);
  if (i >= 0) {
    ctrl.setBeatCursor(i);
    await wait(80);
  }
};
