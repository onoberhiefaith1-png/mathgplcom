/**
 * Game line ownership is saved with the work, so a reopened Game puts every
 * row back on the line it was written on instead of guessing from its text.
 */
export type LineOwners = Record<number, number>;

/** Accepts only finite row → non-negative integer line pairs. */
export function sanitizeLineOwners(raw: unknown): LineOwners | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: LineOwners = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const row = Number(key);
    const line = Number(value);
    if (!Number.isFinite(row) || !Number.isInteger(line) || line < 0) continue;
    out[row] = line;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Saved ownership wins for every row that still carries ink and points at a
 * real line; rows the save does not know about keep the rebuilt owner.
 */
export function mergeSavedLineOwners(
  rebuilt: LineOwners,
  saved: LineOwners | null,
  inkRows: number[],
  validLines: Set<number>,
): LineOwners {
  if (!saved) return rebuilt;
  const out: LineOwners = { ...rebuilt };
  for (const row of inkRows) {
    const owner = saved[row];
    if (owner !== undefined && validLines.has(owner)) out[row] = owner;
  }
  return out;
}
