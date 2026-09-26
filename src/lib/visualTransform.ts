export const VISUAL_ZOOM_MIN = 0.5;
export const VISUAL_ZOOM_MAX = 5;
export const VISUAL_ZOOM_STEP = 0.25;

export function clampVisualZoom(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(VISUAL_ZOOM_MAX, Math.max(VISUAL_ZOOM_MIN, Math.round(n * 100) / 100));
}

export function clampBoundedOffset(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, n));
}

export function diagramFlowHeight(args: {
  authoredHeight: number;
  naturalHeight: number;
  zoom: number;
  offsetY?: number;
  minimum?: number;
}): number {
  const authored = Math.max(0, Number(args.authoredHeight) || 0);
  const natural = Math.max(0, Number(args.naturalHeight) || 0);
  const offset = Math.max(0, Number(args.offsetY) || 0);
  return Math.max(args.minimum ?? 0, authored, natural * clampVisualZoom(args.zoom) + offset);
}

export function clampSlideMove(position: number, size: number, recoverable = 0.08): number {
  const safeSize = Math.max(0, Number(size) || 0);
  const visible = Math.min(recoverable, Math.max(0.02, safeSize));
  return clampBoundedOffset(position, -safeSize + visible, 1 - visible);
}
