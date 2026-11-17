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

/** Cursor-anchored zoom: the world point under (px, py) stays put. */
export function zoomAt(
  view: DigitalView,
  width: number,
  height: number,
  px: number,
  py: number,
  factor: number,
): DigitalView {
  const world = toData(px, py, view, width, height);
  const scaleX = clampScale(view.scaleX * factor);
  const scaleY = clampScale(view.scaleY * factor);
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

/** Snap a world point to the current minor grid step. */
export function snapWorld(
  x: number,
  y: number,
  view: DigitalView,
  width: number,
  height: number,
): { x: number; y: number } {
  const major = majorStep(view, width, height);
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
export function gridLines(view: DigitalView, width: number, height: number): { vertical: GridLine[]; horizontal: GridLine[] } {
  const b = visibleBounds(view, width, height);
  const major = majorStep(view, width, height);
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
