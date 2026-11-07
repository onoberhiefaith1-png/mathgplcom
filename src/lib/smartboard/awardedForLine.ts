/**
 * Marks the Evaluation panel shows as AWARDED for one line. The saved
 * progress row is one source; the board's own broadcast award is the other —
 * a teacher test sitting (and an instant predictive award before its save
 * lands) never writes progress, so reading only the row showed
 * "Equivalent · Awarded 0/2" for a line the board had already paid.
 * Only a CORRECT broadcast counts, so a wrong answer can never show marks.
 */
export const awardedForLine = (input: {
  slot: string;
  savedSolved?: Record<string, number> | null;
  check?: { correct?: boolean; marks?: number; progress?: { solvedLines?: Record<string, number> } } | null;
  lineMarks: number;
}): number => {
  const saved = Number(input.savedSolved?.[input.slot] ?? 0) || 0;
  const c = input.check;
  const fromBroadcast = c?.correct
    ? Math.max(Number(c.marks ?? 0) || 0, Number(c.progress?.solvedLines?.[input.slot] ?? 0) || 0)
    : 0;
  const best = Math.max(saved, fromBroadcast);
  return input.lineMarks > 0 ? Math.min(best, input.lineMarks) : best;
};
