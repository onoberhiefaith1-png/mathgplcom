export const GAME_TABLE_SCALE_MIN = 0.7;
export const GAME_TABLE_SCALE_MAX = 1.6;
export const GAME_TABLE_SCALE_STEP = 0.1;
export const GAME_TABLE_SCALE_DEFAULT = 1.3;

export const clampGameTableScale = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return GAME_TABLE_SCALE_DEFAULT;
  return Math.min(
    GAME_TABLE_SCALE_MAX,
    Math.max(GAME_TABLE_SCALE_MIN, Math.round(parsed * 10) / 10),
  );
};

export const stepGameTableScale = (value: unknown, direction: -1 | 1): number =>
  clampGameTableScale(clampGameTableScale(value) + direction * GAME_TABLE_SCALE_STEP);

/** Compact Game surfaces follow the rendered table instead of filling a view. */
export const gameTableSurfaceHeightPx = (args: {
  naturalHeightPx: number;
  scale?: number;
  measuredHeightPx?: number;
}): number => {
  const measured = Number(args.measuredHeightPx);
  if (Number.isFinite(measured) && measured > 0) return Math.max(96, Math.ceil(measured));
  const natural = Math.max(0, Number(args.naturalHeightPx) || 0);
  return Math.max(96, Math.ceil(natural * clampGameTableScale(args.scale)));
};

interface TableMetricsGrid {
  rows: number;
  cols: number;
  headers?: string[];
  colWidths?: number[];
  style?: { cellPadY?: number; textSize?: number };
  subcells?: Record<string, unknown>;
  advanced?: boolean;
}

/** Lesson Note table dimensions, including the two-tier Calculation Subcells. */
export const gameTableNaturalSize = (grid: TableMetricsGrid | null | undefined) => {
  const rows = Math.max(1, Number(grid?.rows) || 1);
  const cols = Math.max(1, Number(grid?.cols) || 1);
  const textSize = Math.max(9, Number(grid?.style?.textSize) || 15);
  const padY = Math.max(0, Number(grid?.style?.cellPadY) || 8);
  const widths = Array.from({ length: cols }, (_, c) => Math.max(72, Number(grid?.colWidths?.[c]) || 72));
  const width = widths.reduce((sum, value) => sum + value, 0);
  const baseRowHeight = textSize * 1.4 + padY * 2;
  const hasHeaders = (grid?.headers ?? []).some((header) => String(header).trim());
  let height = hasHeaders ? baseRowHeight : 0;
  for (let r = 0; r < rows; r++) {
    const hasSubcell = grid?.advanced !== false && Array.from({ length: cols }, (_, c) => `${r}:${c}`)
      .some((key) => Boolean(grid?.subcells?.[key]));
    height += baseRowHeight * (hasSubcell ? 1.8 : 1);
  }
  // Title, progress and bold action strip belong to the same physical surface.
  return { width: width + 4, height: height + 100 };
};
