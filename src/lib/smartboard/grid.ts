// Invisible mathematical writing grid for the Smartboard.
// Scale-aware: a single `zoom` multiplier rescales the writing without
// changing the board surface. Margins are kept in screen pixels so the
// outer chrome and scroll feel stay constant.
//
// `lineSpacing` multiplies only the vertical gap between baselines —
// teachers raise it for more breathing space around fractions/roots
// without changing the math itself.
//
// `textScale` multiplies only the writing font size — the page, margins
// and chrome stay the same; only the content grows.

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

/**
 * @param zoom         page-zoom multiplier (existing control)
 * @param lineSpacing  vertical gap multiplier between lesson lines (new)
 * @param textScale    content-only font multiplier — does not affect spacing (new)
 */
export const getGrid = (
  zoom = 1,
  lineSpacing = 1,
  textScale = 1,
): Grid => ({
  MARGIN_LEFT: BASE.MARGIN_LEFT,
  MARGIN_TOP: BASE.MARGIN_TOP,
  LINE_HEIGHT: BASE.LINE_HEIGHT * zoom * lineSpacing,
  BASELINE_OFFSET: BASE.BASELINE_OFFSET,
  CARET_HEIGHT: BASE.CARET_HEIGHT * zoom * textScale,
  FONT_PX: BASE_FONT_PX * zoom * textScale,
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

/** Preset multipliers for the Settings panel. */
export const LINE_SPACING_PRESETS = [
  { id: "compact", label: "Compact", value: 0.85 },
  { id: "normal", label: "Normal", value: 1.0 },
  { id: "comfortable", label: "Comfortable", value: 1.2 },
  { id: "wide", label: "Wide", value: 1.45 },
] as const;

export const TEXT_SIZE_PRESETS = [
  { id: "s", label: "S", value: 0.85 },
  { id: "m", label: "M", value: 1.0 },
  { id: "l", label: "L", value: 1.18 },
  { id: "xl", label: "XL", value: 1.4 },
] as const;

export const clampLineSpacing = (v: number) => Math.max(0.6, Math.min(2.0, v));
export const clampTextScale = (v: number) => Math.max(0.7, Math.min(1.8, v));
