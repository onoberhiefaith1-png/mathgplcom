// Invisible mathematical writing grid for the Smartboard.
// Scale-aware: a single `zoom` multiplier rescales the writing without
// changing the board surface. Margins are kept in screen pixels so the
// outer chrome and scroll feel stay constant.

const BASE = {
  MARGIN_LEFT: 80,
  MARGIN_TOP: 72,
  LINE_HEIGHT: 64,
  BASELINE_OFFSET: 0.78,
  CARET_HEIGHT: 44,
} as const;

/** One em of writing equals this many CSS pixels at zoom = 1. */
export const BASE_FONT_PX = 34;

export interface Grid {
  MARGIN_LEFT: number;
  MARGIN_TOP: number;
  LINE_HEIGHT: number;
  BASELINE_OFFSET: number;
  CARET_HEIGHT: number;
  FONT_PX: number;
}

export const getGrid = (zoom = 1): Grid => ({
  MARGIN_LEFT: BASE.MARGIN_LEFT,
  MARGIN_TOP: BASE.MARGIN_TOP,
  LINE_HEIGHT: BASE.LINE_HEIGHT * zoom,
  BASELINE_OFFSET: BASE.BASELINE_OFFSET,
  CARET_HEIGHT: BASE.CARET_HEIGHT * zoom,
  FONT_PX: BASE_FONT_PX * zoom,
});

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
