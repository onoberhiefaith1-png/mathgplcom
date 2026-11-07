import {
  lineTimer,
  normalizeFloatingVaults,
  type FloatingLine,
  type FloatingVault,
} from "@/lib/lessonnotes/floatingCompile";

/** The compiled board line the Game must give its own writing surface. */
export interface BoardLineIdentity {
  lineId: string;
}

export interface AlignedGameLineMeta {
  lineTimers: (number | null)[];
  lineVaults: (FloatingVault[] | null)[];
}

/**
 * Game Line N must be board line N - 1: Line 0 is the question, and every
 * compiled board line (the Floating Numbers the student solves) owns exactly
 * one further writing surface. Timers and Vaults come from the authored
 * Floating Numbers lines, which can be a different list (notes compile into
 * extra board lines, and an assigned copy keeps its own lines when the lesson
 * note changes later). So the per-line data is joined to the BOARD lines by
 * identity, and the result always has one entry per board line — the surface
 * count can never drift from the number line count.
 */
export const alignGameLineMeta = (
  boardLines: readonly BoardLineIdentity[],
  floatingLines: readonly Partial<FloatingLine>[],
): AlignedGameLineMeta => {
  const byId = new Map<string, Partial<FloatingLine>>();
  for (const line of floatingLines) {
    for (const key of [line.lineId, line.sourceUid]) {
      if (key && !byId.has(key)) byId.set(key, line);
    }
  }
  const sameShape = boardLines.length === floatingLines.length;
  const lineTimers: (number | null)[] = [];
  const lineVaults: (FloatingVault[] | null)[] = [];
  boardLines.forEach((board, i) => {
    const source = byId.get(board.lineId) ?? (sameShape ? floatingLines[i] : undefined);
    lineTimers.push(source ? lineTimer(source) : null);
    lineVaults.push(
      source && Object.prototype.hasOwnProperty.call(source, "vaults")
        ? normalizeFloatingVaults(source.vaults)
        : null,
    );
  });
  return { lineTimers, lineVaults };
};
