// Invisible mathematical writing grid for the Smartboard.
//
// Terminology (locked):
//   Section      — major lesson block (Title, Introduction, Example, Solution, Summary).
//   Lesson Line  — one complete teaching step; may span multiple Rows.
//   Row          — invisible horizontal writing guide; layout position only.
//   Row Spacing  — vertical distance between consecutive Rows.
//
// Scale-aware: a single `zoom` multiplier rescales the writing without
// changing the board surface. Margins are kept in screen pixels so the
// outer chrome and scroll feel stay constant.
//
// `rowSpacing` is the teacher-controlled EXTRA gap between consecutive
// rows. 0 = no extra gap; increasing it only separates rows, never the
// internal pieces of a fraction/root/matrix (those are rendered with
// their own intrinsic height by MathTreeRender, not via row count).
//
// `textScale` multiplies only the writing font size — the page, margins
// and chrome stay the same; only the content (Lesson Objects) grows.

const BASE = {
  MARGIN_LEFT: 80,
  MARGIN_TOP: 72,
  BASELINE_OFFSET: 0.78,
  CARET_HEIGHT: 44,
} as const;

/** One em of writing equals this many CSS pixels at zoom = 1. */
export const BASE_FONT_PX = 34;

/** Smallest natural distance between row baselines at 0% Row Spacing.
 *  This is the editor's default writing rhythm, not an added blank row. */
const MIN_ROW_PER_FONT = 1.16;

/** Maximum extra gap added when the Row Spacing slider reaches 100%. */
const MAX_EXTRA_GAP = 44;

export const clampRowSpacing = (v: number) => Math.max(0, Math.min(1, v));
/** @deprecated Use `clampRowSpacing`. Kept for legacy import paths. */
export const clampLineSpacing = clampRowSpacing;
export const clampTextScale = (v: number) => Math.max(0.7, Math.min(1.8, v));

export interface Grid {
  MARGIN_LEFT: number;
  MARGIN_TOP: number;
  LINE_HEIGHT: number;
  BASELINE_OFFSET: number;
  CARET_HEIGHT: number;
  FONT_PX: number;
}

/**
 * @param zoom         page-zoom multiplier (existing control)
 * @param rowSpacing   extra vertical gap between consecutive rows, 0..1.
 *                     0% means no extra gap above the natural row pitch.
 * @param textScale    content-only font multiplier — grows lesson text
 *                     and math; row height follows so nothing clips.
 */
export const getGrid = (
  zoom = 1,
  rowSpacing = 0,
  textScale = 1,
): Grid => {
  const fontPx = BASE_FONT_PX * zoom * textScale;
  const naturalRow = fontPx * MIN_ROW_PER_FONT;
  const extraGap = clampRowSpacing(rowSpacing) * MAX_EXTRA_GAP * zoom;
  const lineHeight = naturalRow + extraGap;
  return {
    MARGIN_LEFT: BASE.MARGIN_LEFT,
    MARGIN_TOP: BASE.MARGIN_TOP,
    LINE_HEIGHT: lineHeight,
    BASELINE_OFFSET: BASE.BASELINE_OFFSET,
    CARET_HEIGHT: BASE.CARET_HEIGHT * zoom * textScale,
    FONT_PX: fontPx,
  };
};

/** Legacy export — equivalent to getGrid(1). */
export const GRID = getGrid(1);

export interface GridPoint {
  line: number;
  x: number;
}

export const lineToY = (line: number, g: Grid = GRID): number =>
  g.MARGIN_TOP + line * g.LINE_HEIGHT + g.LINE_HEIGHT * g.BASELINE_OFFSET;

export const yToLine = (y: number, g: Grid = GRID): number =>
  Math.max(0, Math.round((y - g.MARGIN_TOP) / g.LINE_HEIGHT));

export const snapToBaseline = (
  p: { x: number; y: number },
  g: Grid = GRID,
): GridPoint & { baselineY: number } => {
  const line = yToLine(p.y, g);
  const x = Math.max(0, p.x - g.MARGIN_LEFT);
  return { line, x, baselineY: lineToY(line, g) };
};

export const caretPosition = (p: GridPoint, g: Grid = GRID) => ({
  top: lineToY(p.line, g) - g.CARET_HEIGHT * 0.82,
  left: g.MARGIN_LEFT + p.x,
  height: g.CARET_HEIGHT,
});

export const entryPosition = (p: GridPoint, g: Grid = GRID) => ({
  top: lineToY(p.line, g) - g.LINE_HEIGHT * g.BASELINE_OFFSET,
  left: g.MARGIN_LEFT + p.x,
  lineHeight: `${g.LINE_HEIGHT}px`,
});

