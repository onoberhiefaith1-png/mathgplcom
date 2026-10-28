// Pixel-based font scaling for diagram labels. The SVG viewBox auto-fits
// to the geometry, so text set in raw SVG units shrinks visually as the
// diagram grows. This context exposes `unitsPerPixel` so labels can pick
// an SVG font size that renders at a fixed on-screen pixel size.

import { createContext, useContext } from "react";

export const MIN_FONT_PX = 11;
export const BASE_FONT_PX = 13;
export const MAX_FONT_PX = 18;
export const PAD_PX = 4;

export interface LabelScale {
  /** SVG units per rendered CSS pixel. Multiply px sizes by this to get SVG units. */
  unitsPerPixel: number;
}

export const LabelScaleContext = createContext<LabelScale>({ unitsPerPixel: 1 });

export const useLabelScale = (): LabelScale => useContext(LabelScaleContext);

/** Clamp an override (or fall back to base) into the readable range. */
export function pickFontPx(override?: number | string | null): number {
  const n = typeof override === "number" ? override
    : typeof override === "string" && override && override !== "auto" ? Number(override)
    : NaN;
  if (Number.isFinite(n) && n > 0) {
    return Math.min(MAX_FONT_PX * 1.4, Math.max(8, n));
  }
  return BASE_FONT_PX;
}

/** Convert CSS px to SVG units using the current scale. */
export function pxToSvg(px: number, s: LabelScale): number {
  return px * s.unitsPerPixel;
}
