/** Permanent achievements only accumulate; stale responses cannot remove earned slots. */
export function mergeVerifiedMarks(previous: Record<string, number>, incoming: Record<string, number>) {
  const merged = { ...previous };
  for (const [slot, value] of Object.entries(incoming)) {
    if (Number.isFinite(value) && value >= 0) merged[slot] = Math.max(Number(merged[slot]) || 0, value);
  }
  return merged;
}
export const verifiedScore = (slots: Record<string, number>) => Object.values(slots).reduce((sum, value) => sum + (Number.isFinite(value) && value > 0 ? value : 0), 0);

/** Unscored text is not part of a timed full-mark requirement. Permanent marks from an earlier attempt never count here. */
export function attemptProgress(questionId: string, lines: readonly { lineId?: string; marks?: number; notebookOnly?: boolean }[], confirmed: Record<string, number>) {
  const required = new Map<string, number>();
  let unmappedMarks = 0;
  for (const line of lines) if (!line.notebookOnly && Number.isFinite(Number(line.marks)) && Number(line.marks) > 0) {
    if (!line.lineId) { unmappedMarks += Number(line.marks); continue; }
    const slot = `${questionId}:${line.lineId}`;
    required.set(slot, Math.max(required.get(slot) ?? 0, Number(line.marks)));
  }
  const total = [...required.values()].reduce((sum, marks) => sum + marks, unmappedMarks);
  const score = [...required].reduce((sum, [slot, marks]) => sum + Math.min(marks, Math.max(0, Number(confirmed[slot]) || 0)), 0);
  return { total, score, complete: total > 0 && unmappedMarks === 0 && [...required].every(([slot, marks]) => Number(confirmed[slot]) >= marks) };
}

/** A predicted award still needs its persistence request, even though the UI already shows its marks. */
export const needsAwardPersistence = (slot: string, pending: Record<string, boolean>) => pending[slot] === true;

/** Serialise writes to the same progress row; dry-run look-ahead is deliberately independent. */
export function createGradeQueue() {
  const tails = new Map<string, Promise<unknown>>();
  return async function run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    tails.set(key, current);
    try { return await current; } finally { if (tails.get(key) === current) tails.delete(key); }
  };
}
