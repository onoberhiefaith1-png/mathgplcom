/** Math Lab-style digital view for Smart Graph: equal-aspect zoom/pan and a 1-2-5 grid. */

import { niceStep } from "@/lib/graphApp/math";

export const SQ_BASE = 28; // pixels per centimetre square at 100% paper zoom (legacy).
export const MIN_SCALE = 2;
export const MAX_SCALE = 5000;

export type DigitalView = {
  /** World x at the centre of the plot. */
  cx: number;
  /** World y at the centre of the plot. */
  cy: number;
  /** Pixels per world unit on X. */
  scaleX: number;
  /** Pixels per world unit on Y. */
  scaleY: number;
};

/** Major tick / grid step on each axis. Independent of zoom (pixels per unit). */
export type TickStep = { x: number; y: number };

/** Keep major-tick labels readable: cap how small (and how large) a cell may get. */
export const MIN_PX_PER_MAJOR = 24;
export const MAX_PX_PER_MAJOR = 280;

export type PaperGraph = {
  unitsPerSquareX: number;
  unitsPerSquareY: number;
  squaresX: number;
  squaresY: number;
  originSquareX: number;
  originSquareY: number;
  viewZoom?: number;
  viewCx?: number | null;
  viewCy?: number | null;
  viewScaleX?: number | null;
  viewScaleY?: number | null;
};

const clampScale = (s: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, Number.isFinite(s) ? s : MIN_SCALE));

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Pixel size of the legacy paper (used as the SVG plot size). */
export function paperSize(p: PaperGraph): { w: number; h: number; sq: number } {
  const sq = SQ_BASE * (p.viewZoom && p.viewZoom > 0 ? p.viewZoom : 1);
  return { w: p.squaresX * sq, h: p.squaresY * sq, sq };
}

/**
 * Build a digital view from a saved paper graph so existing documents open
 * on the same world window, with points in the same place.
 * If a digital view was already saved, that wins.
 */
export function viewFromPaper(p: PaperGraph, width?: number, height?: number): DigitalView {
  const savedX = num(p.viewScaleX), savedY = num(p.viewScaleY);
  const savedCx = num(p.viewCx), savedCy = num(p.viewCy);
  if (savedX != null && savedY != null && savedCx != null && savedCy != null) {
    return { cx: savedCx, cy: savedCy, scaleX: clampScale(savedX), scaleY: clampScale(savedY) };
  }
  const { w, h, sq } = paperSize(p);
  const plotW = width && width > 0 ? width : w;
  const plotH = height && height > 0 ? height : h;
  const ux = Math.abs(p.unitsPerSquareX) || 1;
  const uy = Math.abs(p.unitsPerSquareY) || 1;
  const oxPx = p.originSquareX * sq;
  const oyPx = p.originSquareY * sq;
  return {
    cx: ((plotW / 2) - oxPx) / sq * ux,
    cy: (oyPx - plotH / 2) / sq * uy,
    scaleX: clampScale(sq / ux),
    scaleY: clampScale(sq / uy),
  };
}

export function toPx(
  p: { x: number; y: number },
  view: DigitalView,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: width / 2 + (p.x - view.cx) * view.scaleX,
    y: height / 2 - (p.y - view.cy) * view.scaleY,
  };
}

export function toData(
  px: number,
  py: number,
  view: DigitalView,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: view.cx + (px - width / 2) / view.scaleX,
    y: view.cy - (py - height / 2) / view.scaleY,
  };
}

export type ZoomAxis = "x" | "y" | "both";
export type ZoomHighlight = "x" | "y" | "origin" | "none";
export type ZoomZone = { axis: ZoomAxis; highlight: ZoomHighlight };

/** Pixel half-width of the zoom strips: one current major grid step on
 *  each axis, in screen pixels. */
export function zoomStripSize(view: DigitalView, width: number, height: number, tickStep?: TickStep): { x: number; y: number } {
  const major = resolveTickStep(view, width, height, tickStep);
  return { x: major.x * view.scaleX, y: major.y * view.scaleY };
}

/** Vertical strip around the Y axis and horizontal strip around the X axis,
 *  in plot-pixel coordinates. Used to paint the faint zoom highlight. */
export function zoomStripRects(view: DigitalView, width: number, height: number, tickStep?: TickStep): {
  vertical: { x: number; y: number; width: number; height: number };
  horizontal: { x: number; y: number; width: number; height: number };
} {
  const origin = toPx({ x: 0, y: 0 }, view, width, height);
  const band = zoomStripSize(view, width, height, tickStep);
  return {
    vertical: { x: origin.x - band.x, y: 0, width: band.x * 2, height },
    horizontal: { x: 0, y: origin.y - band.y, width, height: band.y * 2 },
  };
}

/**
 * Three-zone axis zoom. The strip around each axis is one major grid square
 * in screen pixels (inclusive). Inside only the horizontal strip around
 * y = 0 (and not the origin) → scale X. Inside only the vertical strip
 * around x = 0 (and not the origin) → scale Y. At the origin (inside both
 * strips) or outside both strips → scale both.
 */
export function zoomZone(
  view: DigitalView,
  width: number,
  height: number,
  px: number,
  py: number,
  tickStep?: TickStep,
): ZoomZone {
  const origin = toPx({ x: 0, y: 0 }, view, width, height);
  const band = zoomStripSize(view, width, height, tickStep);
  const nearYAxis = Math.abs(px - origin.x) <= band.x + 1e-9;
  const nearXAxis = Math.abs(py - origin.y) <= band.y + 1e-9;
  if (nearXAxis && nearYAxis) return { axis: "both", highlight: "origin" };
  if (nearXAxis) return { axis: "x", highlight: "x" };
  if (nearYAxis) return { axis: "y", highlight: "y" };
  return { axis: "both", highlight: "none" };
}

/** Cursor-anchored zoom: the world point under (px, py) stays put.
 *  `axis` defaults to "both" so existing equal-aspect callers are unchanged. */
export function zoomAt(
  view: DigitalView,
  width: number,
  height: number,
  px: number,
  py: number,
  factor: number,
  axis: ZoomAxis = "both",
  tickStep?: TickStep,
): DigitalView {
  const world = toData(px, py, view, width, height);
  const f = tickStep ? limitedZoomFactor(view, factor, tickStep, axis) : factor;
  const scaleX = axis === "y" ? view.scaleX : clampScale(view.scaleX * f);
  const scaleY = axis === "x" ? view.scaleY : clampScale(view.scaleY * f);
  return {
    scaleX,
    scaleY,
    cx: world.x - (px - width / 2) / scaleX,
    cy: world.y + (py - height / 2) / scaleY,
  };
}

export function panView(view: DigitalView, dxPx: number, dyPx: number): DigitalView {
  return {
    ...view,
    cx: view.cx - dxPx / view.scaleX,
    cy: view.cy + dyPx / view.scaleY,
  };
}

export function visibleBounds(view: DigitalView, width: number, height: number) {
  return {
    x0: view.cx - width / 2 / view.scaleX,
    x1: view.cx + width / 2 / view.scaleX,
    y0: view.cy - height / 2 / view.scaleY,
    y1: view.cy + height / 2 / view.scaleY,
  };
}

export function majorStep(view: DigitalView, width: number, height: number, targetTicks = 10): { x: number; y: number } {
  const b = visibleBounds(view, width, height);
  return {
    x: niceStep(b.x1 - b.x0, targetTicks),
    y: niceStep(b.y1 - b.y0, targetTicks),
  };
}

export function minorStepOf(major: number): number {
  return major / 5;
}

/** Use a caller-supplied tick step when it is valid; otherwise the zoom-dependent 1-2-5 step. */
export function resolveTickStep(
  view: DigitalView,
  width: number,
  height: number,
  tickStep?: TickStep,
): TickStep {
  if (tickStep && tickStep.x > 0 && tickStep.y > 0 && Number.isFinite(tickStep.x) && Number.isFinite(tickStep.y)) {
    return { x: tickStep.x, y: tickStep.y };
  }
  return majorStep(view, width, height);
}

/**
 * Major tick step from a set of data points (including the origin).
 * Used to freeze the table-graph scale so zoom cannot change it.
 */
export function tickStepFromPoints(
  points: Array<{ x: number; y: number }>,
  targetTicks = 8,
): TickStep {
  const pts = points.length ? points : [{ x: 0, y: 0 }];
  let xmin = Math.min(0, ...pts.map((p) => p.x));
  let xmax = Math.max(0, ...pts.map((p) => p.x));
  let ymin = Math.min(0, ...pts.map((p) => p.y));
  let ymax = Math.max(0, ...pts.map((p) => p.y));
  if (xmin === xmax) { xmin -= 1; xmax += 1; }
  if (ymin === ymax) { ymin -= 1; ymax += 1; }
  return {
    x: niceStep(xmax - xmin, targetTicks),
    y: niceStep(ymax - ymin, targetTicks),
  };
}

/** Clamp a zoom factor so major-tick cells stay within a readable pixel size. */
export function limitedZoomFactor(
  view: DigitalView,
  factor: number,
  tickStep: TickStep,
  axis: ZoomAxis = "both",
): number {
  if (!(factor > 0) || !Number.isFinite(factor)) return 1;
  const limits = (major: number, scale: number) => {
    if (!(major > 0) || !(scale > 0)) return { lo: factor, hi: factor };
    return {
      lo: MIN_PX_PER_MAJOR / (major * scale),
      hi: MAX_PX_PER_MAJOR / (major * scale),
    };
  };
  let lo = 0;
  let hi = Infinity;
  if (axis !== "y") {
    const x = limits(tickStep.x, view.scaleX);
    lo = Math.max(lo, x.lo);
    hi = Math.min(hi, x.hi);
  }
  if (axis !== "x") {
    const y = limits(tickStep.y, view.scaleY);
    lo = Math.max(lo, y.lo);
    hi = Math.min(hi, y.hi);
  }
  if (hi < lo) return 1;
  return Math.min(Math.max(factor, lo), hi);
}

/** Snap a world point to the current minor grid step. */
export function snapWorld(
  x: number,
  y: number,
  view: DigitalView,
  width: number,
  height: number,
  tickStep?: TickStep,
): { x: number; y: number } {
  const major = resolveTickStep(view, width, height, tickStep);
  const sx = minorStepOf(major.x);
  const sy = minorStepOf(major.y);
  const snap = (v: number, step: number) => {
    if (!(step > 0) || !Number.isFinite(v)) return v;
    const n = Math.round(v / step) * step;
    // Tidy binary rounding so 0.1 * 3 stays 0.3, not 0.30000000004.
    const dec = Math.max(0, Math.min(8, Math.ceil(-Math.log10(step)) + 1));
    const f = 10 ** dec;
    return Math.round(n * f) / f;
  };
  return { x: snap(x, sx), y: snap(y, sy) };
}

/** Decimal rounding used when snap-to-grid is off. */
export function roundedWorld(x: number, y: number): { x: number; y: number } {
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

/** A placed point: snap to the current per-axis minor grid when asked, otherwise the usual 0.1 rounding. */
export function placeWorldPoint(
  x: number,
  y: number,
  view: DigitalView,
  width: number,
  height: number,
  snapToGrid: boolean,
  tickStep?: TickStep,
): { x: number; y: number } {
  return snapToGrid ? snapWorld(x, y, view, width, height, tickStep) : roundedWorld(x, y);
}

export type GridLine = { pos: number; world: number; major: boolean };

function lines(start: number, end: number, major: number): GridLine[] {
  const minor = minorStepOf(major);
  if (!(minor > 0) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const first = Math.ceil((start - 1e-12) / minor) * minor;
  const out: GridLine[] = [];
  const count = Math.ceil((end - first) / minor) + 2;
  for (let i = 0; i < count; i++) {
    const world = first + i * minor;
    if (world > end + 1e-12) break;
    const ratio = Math.abs(world / major);
    const majorHit = Math.abs(ratio - Math.round(ratio)) < 1e-8;
    out.push({ pos: 0, world, major: majorHit });
  }
  return out;
}

/** Vertical (x) and horizontal (y) grid lines in pixel coordinates. */
export function gridLines(view: DigitalView, width: number, height: number, tickStep?: TickStep): { vertical: GridLine[]; horizontal: GridLine[] } {
  const b = visibleBounds(view, width, height);
  const major = resolveTickStep(view, width, height, tickStep);
  const vertical = lines(b.x0, b.x1, major.x).map((l) => ({ ...l, pos: toPx({ x: l.world, y: 0 }, view, width, height).x }));
  const horizontal = lines(b.y0, b.y1, major.y).map((l) => ({ ...l, pos: toPx({ x: 0, y: l.world }, view, width, height).y }));
  return { vertical, horizontal };
}

/** Fit a set of world points into a plot with comfortable padding. */
export function fitPoints(
  points: Array<{ x: number; y: number }>,
  width: number,
  height: number,
): DigitalView {
  if (!points.length) {
    return viewFromPaper({
      unitsPerSquareX: 1, unitsPerSquareY: 1,
      squaresX: 40, squaresY: 16, originSquareX: 20, originSquareY: 8,
    }, width, height);
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  let xmin = Math.min(...xs), xmax = Math.max(...xs);
  let ymin = Math.min(...ys), ymax = Math.max(...ys);
  if (xmin === xmax) { xmin -= 1; xmax += 1; }
  if (ymin === ymax) { ymin -= 1; ymax += 1; }
  if (xmin > 0) xmin = Math.min(0, xmin);
  if (xmax < 0) xmax = Math.max(0, xmax);
  if (ymin > 0) ymin = Math.min(0, ymin);
  if (ymax < 0) ymax = Math.max(0, ymax);
  const padX = Math.max(1, (xmax - xmin) * 0.15);
  const padY = Math.max(1, (ymax - ymin) * 0.15);
  xmin -= padX; xmax += padX; ymin -= padY; ymax += padY;
  const scaleX = clampScale((width - 48) / (xmax - xmin));
  const scaleY = clampScale((height - 48) / (ymax - ymin));
  // Keep a single visual scale so circles stay circular, using the tighter fit.
  const scale = Math.min(scaleX, scaleY);
  return { cx: (xmin + xmax) / 2, cy: (ymin + ymax) / 2, scaleX: scale, scaleY: scale };
}

export function zoomFactorFromWheel(deltaY: number, deltaMode: number): number {
  const dy = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 100 : 1);
  return Math.exp(-dy * 0.0015);
}
