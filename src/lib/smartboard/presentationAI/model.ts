// Presentation AI — expected-state model.
// Turns the Presenter Preview data (beats + reservoirs) into a linear
// sequence of "steps" that mirror how a human teacher would perform the
// lesson: enter a beat, start a line, click each floating number in order,
// optionally drop the teacher note, then verify the completed row.

import type { Beat, Reservoir, ReservoirLine } from "@/lib/smartboard/presentation";

export interface EnterBeatStep {
  kind: "beat";
  beatIndex: number;
  beat: Beat;
}

export interface LineStartStep {
  kind: "line-start";
  beatIndex: number;
  beat: Beat;
  lineIdx: number;
  line: ReservoirLine;
  reservoir: Reservoir;
}

export interface FillerStep {
  kind: "filler";
  beatIndex: number;
  beat: Beat;
  lineIdx: number;
  line: ReservoirLine;
  reservoir: Reservoir;
  /** Zero-based filler index just placed. Expected prefix length = fillerIdx + 1. */
  fillerIdx: number;
  totalFillers: number;
}

export interface NoteStep {
  kind: "note";
  beatIndex: number;
  beat: Beat;
  lineIdx: number;
  line: ReservoirLine;
  reservoir: Reservoir;
}

export interface LineVerifyStep {
  kind: "line-verify";
  beatIndex: number;
  beat: Beat;
  lineIdx: number;
  line: ReservoirLine;
  reservoir: Reservoir;
}

export type PresentationStep =
  | EnterBeatStep
  | LineStartStep
  | FillerStep
  | NoteStep
  | LineVerifyStep;

// Note-purity predicate — mirrors the auto-reveal effect in PresentationView.
export const looksLikeMathLine = (l: string): boolean => {
  const s = l.trim();
  if (!s) return false;
  if (/[=+\-−×÷/^]/.test(s)) return true;
  if (/^[\d\s.,()πθ]+$/.test(s)) return true;
  return false;
};

export const isRenderableNote = (raw: string | undefined | null): boolean => {
  const t = (raw ?? "").trim();
  if (!t) return false;
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  return !lines.some(looksLikeMathLine);
};

/** The first solution line of a section is the ORIGINAL problem restated —
 *  the AI writes it wholesale, it does not reconstruct it from chips. */
export const isQuestionLine = (lineIdx: number, line: ReservoirLine): boolean => {
  if (lineIdx !== 0) return false;
  if (line.notebookOnly) return false;
  return !!(line.equation ?? "").trim();
};

export const buildSteps = (
  beats: Beat[],
  reservoirs: Reservoir[],
): PresentationStep[] => {
  const byBeat = new Map<string, Reservoir>();
  for (const r of reservoirs) byBeat.set(r.beatId, r);
  const steps: PresentationStep[] = [];
  beats.forEach((beat, beatIndex) => {
    steps.push({ kind: "beat", beatIndex, beat });
    const res = byBeat.get(beat.id);
    if (!res || res.lines.length === 0) return;
    res.lines.forEach((line, lineIdx) => {
      const common = { beatIndex, beat, lineIdx, line, reservoir: res };
      steps.push({ kind: "line-start", ...common });
      // Question line: no chip-picking. Written wholesale via
      // writeQuestionLine in the stepper.
      const isQuestion = isQuestionLine(lineIdx, line);
      if (!isQuestion) {
        const fillers = line.fillers ?? [];
        fillers.forEach((_, fillerIdx) => {
          steps.push({
            kind: "filler",
            ...common,
            fillerIdx,
            totalFillers: fillers.length,
          });
        });
      }
      if (isRenderableNote(line.notebook)) {
        steps.push({ kind: "note", ...common });
      }
      steps.push({ kind: "line-verify", ...common });
    });
  });
  return steps;
};

/** How many sub-steps a single line consumes — used for pacing math. */
export const lineSubStepCount = (line: ReservoirLine, lineIdx = 0): number => {
  const isQuestion = isQuestionLine(lineIdx, line);
  const fillers = isQuestion ? 0 : (line.fillers ?? []).length;
  const noteBeat = isRenderableNote(line.notebook) ? 1 : 0;
  // line-start + fillers + optional note + line-verify
  return 1 + fillers + noteBeat + 1;
};
