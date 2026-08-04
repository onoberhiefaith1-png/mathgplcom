// One Adventure engine, two stagings.
//
// A **stage** is the unit of play. It owns everything inside it: reward,
// progress bar, time bar, effects, characters, particles, floating objects and
// questions. When a stage completes, its reward leaves the screen, every one of
// its objects is removed, and the next stage starts completely fresh.
//
//  - Static Adventure  → stage = Scene   (Scene 1, Scene 2, Scene 3 …)
//  - Video Adventure   → stage = Loop    (a loop region inside one video)
//
// Only the FINAL stage opens the Class Gallery. Earlier rewards are stored
// silently.

import {
  checkpointsOf,
  isVideoAdventure,
  type GameCanvas,
  type Scene,
} from "./types";

/** A stage is a Scene — the same shape doubles as a video Loop region. */
export type Stage = Scene;

/** Stages of a canvas, in play order. */
export const stagesOf = (canvas: GameCanvas | null | undefined): Stage[] => {
  if (!canvas) return [];
  if (isVideoAdventure(canvas)) return checkpointsOf(canvas);
  return canvas.scenes ?? [];
};

/** Element ids that belong to a stage. */
export const stageElementIds = (stage: Stage | null | undefined): Set<string> =>
  new Set((stage?.elements ?? []).map((e) => e.id));

/** Index of a stage in play order (-1 when unknown). */
export const stageIndex = (stages: Stage[], id: string | null | undefined): number =>
  stages.findIndex((s) => s.id === id);

/** True when this stage is the last one — the only stage that opens the Gallery. */
export const isFinalStage = (stages: Stage[], id: string | null | undefined): boolean =>
  stages.length > 0 && stages[stages.length - 1]?.id === id;

/** Progress-bar summary shape this module needs (a subset of AdventureBarSummary). */
export interface StageBar {
  id: string;
  achieved: number;
  required: number;
}

/** Bars of a stage — everything else on the board belongs to another stage. */
export const barsOfStage = <T extends StageBar>(bars: T[], ids: Set<string>): T[] =>
  bars.filter((b) => ids.has(b.id));

/**
 * A stage is complete when every progress bar inside it has reached the goal
 * the teacher configured for that bar (`required` already encodes the goal %).
 */
export const stageComplete = (bars: StageBar[], ids: Set<string>): boolean => {
  const mine = barsOfStage(bars, ids);
  if (mine.length === 0) return false;
  return mine.every((b) => b.required > 0 && b.achieved >= b.required);
};
