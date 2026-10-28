/** Student writing-area size: the current size is the floor, twice it the ceiling. */
export const WRITING_SCALE_MIN = 1;
export const WRITING_SCALE_MAX = 2;
export const WRITING_SCALE_STEP = 0.1;
export const WRITING_SCALE_KEY = "mathgpl.game.writingScale";

export function clampWritingScale(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return WRITING_SCALE_MIN;
  return Math.min(WRITING_SCALE_MAX, Math.max(WRITING_SCALE_MIN, Math.round(n * 10) / 10));
}

export const stepWritingScale = (value: unknown, dir: 1 | -1) =>
  clampWritingScale(clampWritingScale(value) + dir * WRITING_SCALE_STEP);

/** Zooms the whole column while keeping it inside the original 90vw track. */
export function writingAreaStyle(value: unknown) {
  const scale = clampWritingScale(value);
  return {
    zoom: scale,
    width: `calc(90vw / ${scale})`,
    marginInline: `calc(5vw / ${scale})`,
  } as const;
}
