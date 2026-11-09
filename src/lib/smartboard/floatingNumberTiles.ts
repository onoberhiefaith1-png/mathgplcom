/**
 * Uniform floating-number tiles. The size slider grows the square; chip
 * content is laid out inline and fitted inside it, so a fraction or radical
 * never makes one tile taller than its neighbours, and growing the square
 * does not by itself enlarge unfitted text.
 */
import { GAME_CHIP_METRICS, floatingChipPx } from "./floatingNumberSize";
import type { CSSProperties } from "react";

/** Fitted content stays slightly inside the frame so padding still reads. */
export const CHIP_FIT_INSET = 4;

export const chipFlowStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  whiteSpace: "nowrap",
  flexWrap: "nowrap",
  lineHeight: 1,
  verticalAlign: "middle",
};

export function uniformTilePx(scale: number): number {
  return floatingChipPx(scale);
}

export function uniformTileStyle(scale: number): CSSProperties {
  const px = uniformTilePx(scale);
  return {
    width: px,
    height: px,
    minWidth: px,
    minHeight: px,
    maxWidth: px,
    maxHeight: px,
    padding: GAME_CHIP_METRICS.padding,
    fontSize: GAME_CHIP_METRICS.fontPx,
    boxSizing: "border-box",
    overflow: "hidden",
    flex: "0 0 auto",
  };
}

export function chipTrayStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    minWidth: 0,
    flex: 1,
    overflowX: "auto",
    overflowY: "hidden",
    scrollbarWidth: "none",
  };
}

/** Shrink content so it fits in the square; never scale up past its natural size. */
export function fitContentScale(
  availW: number,
  availH: number,
  contentW: number,
  contentH: number,
): number {
  if (!(availW > 0 && availH > 0 && contentW > 0 && contentH > 0)) return 1;
  const next = Math.min(1, availW / contentW, availH / contentH);
  return Math.round(next * 1000) / 1000;
}
