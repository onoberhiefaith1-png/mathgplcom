// Presentation AI — expected-state model.
// Turns the Presenter Preview data (beats + reservoirs) into a linear
// sequence of "steps". Each step is either "enter beat" or "advance line".

import type { Beat, Reservoir, ReservoirLine } from "@/lib/smartboard/presentation";

export interface EnterBeatStep {
  kind: "beat";
  beatIndex: number;
  beat: Beat;
}

export interface AdvanceLineStep {
  kind: "line";
  beatIndex: number;
  beat: Beat;
  lineIdx: number;
  line: ReservoirLine;
  reservoir: Reservoir;
}

export type PresentationStep = EnterBeatStep | AdvanceLineStep;

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
      steps.push({ kind: "line", beatIndex, beat, lineIdx, line, reservoir: res });
    });
  });
  return steps;
};
