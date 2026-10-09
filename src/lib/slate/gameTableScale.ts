export const GAME_TABLE_SCALE_MIN = 0.7;
export const GAME_TABLE_SCALE_MAX = 1.6;
export const GAME_TABLE_SCALE_STEP = 0.1;

export const clampGameTableScale = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(
    GAME_TABLE_SCALE_MAX,
    Math.max(GAME_TABLE_SCALE_MIN, Math.round(parsed * 10) / 10),
  );
};

export const stepGameTableScale = (value: unknown, direction: -1 | 1): number =>
  clampGameTableScale(clampGameTableScale(value) + direction * GAME_TABLE_SCALE_STEP);
