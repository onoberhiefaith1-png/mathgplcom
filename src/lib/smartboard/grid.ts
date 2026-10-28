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

/** One cursor height = this multiple of the base font, at zoom 1.
 *  This is the Row unit: Row Spacing counts cursor heights. */
const MIN_ROW_PER_FONT = 1.16;

/** Row Spacing is a whole number of cursor heights (1, 2, 3, 4 …). */
export const clampRowSpacing = (v: number) =>
  Math.max(1, Math.min(6, Math.round(Number.isFinite(v) ? v : 1)));
/** @deprecated Use `clampRowSpacing`. Kept for legacy import paths. */
export const clampLineSpacing = clampRowSpacing;
export const clampTextScale = (v: number) => Math.max(0.7, Math.min(1.8, v));

/** Migrates legacy fractional Row Spacing (0..1 slider) to the new
 *  whole-number cursor-height model. */
export const normalizeRowSpacing = (v: number): number => {
  if (!Number.isFinite(v)) return 1;
  if (v <= 1) return 1;
  return clampRowSpacing(v);
};

export interface Grid {
  MARGIN_LEFT: number;
  MARGIN_TOP: number;
  LINE_HEIGHT: number;
  BASELINE_OFFSET: number;
  CARET_HEIGHT: number;
  FONT_PX: number;
  /** One cursor height — depends on zoom only. The Row unit. */
  CURSOR_HEIGHT: number;
}

/**
 * Three fully independent controls:
 *   zoom       — scales the whole board (cursor height AND font).
 *   rowSpacing — whole number of cursor heights between writable Rows.
 *                Never touches font size.
 *   textScale  — font size of text/math only. Never touches row pitch;
 *                taller ink claims extra rows downward instead.
 */
export const getGrid = (
  zoom = 1,
  rowSpacing = 1,
  textScale = 1,
  /** 1 = desktop margins. Narrow viewports pass a smaller value so the
   *  writing starts near the left edge and uses the whole width. */
  marginScale = 1,
): Grid => {
  const cursorHeight = BASE_FONT_PX * MIN_ROW_PER_FONT * zoom;
  const fontPx = BASE_FONT_PX * zoom * clampTextScale(textScale);
  const lineHeight = cursorHeight * clampRowSpacing(rowSpacing);
  const ms = Math.max(0.15, Math.min(1, Number.isFinite(marginScale) ? marginScale : 1));
  return {
    MARGIN_LEFT: Math.round(BASE.MARGIN_LEFT * ms),
    MARGIN_TOP: BASE.MARGIN_TOP,
    LINE_HEIGHT: lineHeight,
    BASELINE_OFFSET: BASE.BASELINE_OFFSET,
    CARET_HEIGHT: BASE.CARET_HEIGHT * zoom,
    FONT_PX: fontPx,
    CURSOR_HEIGHT: cursorHeight,
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

