// Reward Conversion.
//
// TIME is the Game's main resource. The teacher sets four factors that say how
// earned rewards become Life and Time. Activation-only rewards (Bomb, the
// Horizontal and Vertical Collectors) never appear here and never convert.

import type { RewardConversion } from "./types";

/** Every conversion factor is a teacher number from 0.1× to 10×. */
export const clampConversion = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(10, Math.max(0.1, Math.round(parsed * 10) / 10));
};

export const defaultConversion = (): RewardConversion => ({
  hourglassToTime: 1,
  lifeToTime: 1,
  vaultToLife: 0.1,
  completionToLife: 0.1,
});

/**
 * Read a saved conversion block. `legacyLifeMultiplier` carries the value from
 * the older `settings.life.multiplier` field so saved Games keep their Life
 * time exactly as the teacher already set it.
 */
export const normalizeConversion = (
  saved: Partial<RewardConversion> | null | undefined,
  legacyLifeMultiplier?: number,
): RewardConversion => {
  const base = defaultConversion();
  return {
    hourglassToTime: clampConversion(saved?.hourglassToTime, base.hourglassToTime),
    lifeToTime: clampConversion(
      saved?.lifeToTime,
      clampConversion(legacyLifeMultiplier, base.lifeToTime),
    ),
    vaultToLife: clampConversion(saved?.vaultToLife, base.vaultToLife),
    completionToLife: clampConversion(saved?.completionToLife, base.completionToLife),
  };
};

/**
 * Convert freshly earned Vault/Bot or Completion Coin units into whole Lives,
 * instantly, keeping the leftover fraction so ten units at 0.1× give exactly
 * one Life with no drift.
 */
export const convertUnitsToLives = (
  pending: number,
  units: number,
  factor: number,
): { lives: number; pending: number } => {
  const earned = Math.max(0, Number(units) || 0);
  const carried = Math.max(0, Number(pending) || 0);
  if (earned <= 0) return { lives: 0, pending: carried };
  // rounded to a tenth of a Life so repeated 0.1× steps stay exact
  const total = Math.round((carried + earned * clampConversion(factor, 0.1)) * 10) / 10;
  const lives = Math.floor(total);
  return { lives, pending: Math.round((total - lives) * 10) / 10 };
};
