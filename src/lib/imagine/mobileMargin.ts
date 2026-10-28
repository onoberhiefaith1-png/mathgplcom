import { clampContentMargin } from "@/lib/slate/layout";

/** The label strip and margin rule may collapse to 5% of its own surface. */
export const MOBILE_MARGIN_MIN_FRACTION = 0.05;
export const MOBILE_MARGIN_MAX_FRACTION = 0.5;

/** Maps the Game's saved 0–0.5 margin onto Imagine's mobile content start. */
export function mobileReservedFraction(contentMargin: number): number {
  const margin = clampContentMargin(contentMargin);
  const range = MOBILE_MARGIN_MAX_FRACTION - MOBILE_MARGIN_MIN_FRACTION;
  return MOBILE_MARGIN_MIN_FRACTION + (margin / 0.5) * range;
}

/** Converts a touch/pointer position into the shared saved content margin. */
export function mobileMarginFromPointer(
  clientX: number,
  surfaceLeft: number,
  surfaceWidth: number,
): number {
  if (!Number.isFinite(surfaceWidth) || surfaceWidth <= 0) return 0;
  const pointerFraction = (clientX - surfaceLeft) / surfaceWidth;
  const reserved = Math.min(
    MOBILE_MARGIN_MAX_FRACTION,
    Math.max(MOBILE_MARGIN_MIN_FRACTION, pointerFraction),
  );
  const range = MOBILE_MARGIN_MAX_FRACTION - MOBILE_MARGIN_MIN_FRACTION;
  return clampContentMargin(((reserved - MOBILE_MARGIN_MIN_FRACTION) / range) * 0.5);
}

/** Label scale follows the reclaimed strip, but never becomes unreadable. */
export function mobileLabelScale(contentMargin: number): number {
  const reserved = mobileReservedFraction(contentMargin);
  const progress = (reserved - MOBILE_MARGIN_MIN_FRACTION)
    / (MOBILE_MARGIN_MAX_FRACTION - MOBILE_MARGIN_MIN_FRACTION);
  return 0.72 + progress * 0.28;
}