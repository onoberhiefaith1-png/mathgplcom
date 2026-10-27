/** Caption overflow includes its first writing row; ink overflow starts below itself. */
export type RowOverflow = readonly [row: number, pixels: number, includeBoundary?: boolean];

export function rowOverflowShift(line: number, entries: readonly RowOverflow[]): number {
  let shift = 0;
  for (const [row, pixels, includeBoundary] of entries) {
    if (row < line || (row === line && includeBoundary)) shift += Math.max(0, pixels);
  }
  return shift;
}
