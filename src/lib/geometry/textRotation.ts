/**
 * Shared helpers for rotated floating text (`GeoLabel`) objects.
 *
 * One source of truth for: the normalized 0…360 angle, the visual centre the
 * rotation pivots around, and the inverse rotation used by hit testing so
 * rotated text stays selectable and draggable.
 */
import type { GeoLabel } from "./scene";

/** Normalize any stored angle (including legacy negatives) into 0…360. */
export function normalizeRotation(deg: number | undefined | null): number {
  if (!deg || !Number.isFinite(deg)) return 0;
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}

/** Estimated rendered size of the text box (same metrics as hit testing). */
export function labelTextMetrics(label: Pick<GeoLabel, "text" | "fontSize">) {
  const fontSize = label.fontSize ?? 13;
  const width = Math.max(14, (label.text?.length ?? 0) * fontSize * 0.58);
  const height = fontSize * 1.3;
  return { fontSize, width, height };
}

/**
 * Visual centre of the text. Text is centre-anchored horizontally with the
 * baseline at `y`, so the centre sits roughly a third of the cap height above
 * the baseline.
 */
export function labelCenter(label: Pick<GeoLabel, "x" | "y" | "text" | "fontSize">) {
  const { fontSize } = labelTextMetrics(label);
  return { cx: label.x, cy: label.y - fontSize * 0.35 };
}

/** Rotate `p` by `-deg` around (cx, cy) — maps a pointer into the text frame. */
export function unrotatePoint(
  p: { x: number; y: number },
  center: { cx: number; cy: number },
  deg: number,
): { x: number; y: number } {
  const rot = normalizeRotation(deg);
  if (rot === 0) return p;
  const rad = (-rot * Math.PI) / 180;
  const dx = p.x - center.cx;
  const dy = p.y - center.cy;
  return {
    x: center.cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: center.cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}
