export const GAME_STARTUP_DEADLINE_MS = 10_000;

export interface GameStartupMilestones {
  dataReady: boolean;
  canvasReady: boolean;
  surfacesReady: boolean;
  paintedReady: boolean;
}

/** Progress is milestone-based: elapsed time never pretends work is complete. */
export function gameStartupProgress(milestones: GameStartupMilestones): number {
  if (!milestones.dataReady) return 10;
  if (!milestones.canvasReady) return 30;
  if (!milestones.surfacesReady) return 50;
  if (!milestones.paintedReady) return 75;
  return 90;
}