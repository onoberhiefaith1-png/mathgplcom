/** Presentation-only cleanup: keep authored questions separate from solution notes. */
const comparable = (text: string) => text.normalize("NFC")
  .replace(/^\s*(?:question|problem)(?:\s+\d+)?\s*[:.)-]\s*/i, "")
  .replace(/\s+/g, " ").trim();

/** Remove only a complete leading question echo. Genuine equations and
 * explanations, partial matches and later recaps are left untouched. */
export function withoutQuestionEcho(note: string, question: string): string {
  const expected = comparable(question);
  if (!expected || !note.trim()) return note;
  const rows = note.split(/\r?\n/);
  for (let end = 1; end <= rows.length; end++) {
    const prefix = comparable(rows.slice(0, end).join("\n"));
    if (prefix === expected) return rows.slice(end).join("\n").trim();
    if (prefix.length > expected.length) break;
  }
  return note;
}

/** A deleted note releases its physical row. Object-only reservations and
 * rows still carrying ink must not be unlocked by a text deletion elsewhere. */
export function releaseErasedNoteRows<T>(locked: Set<number>, before: Record<number, T>, after: Record<number, T>, visible: (row: T) => boolean): Set<number> {
  let next = locked;
  const has = (map: Record<number, T>, row: number) =>
    [row, Math.floor(row), Math.floor(row) + 0.5].some(key => map[key] !== undefined && visible(map[key]));
  for (const row of locked) {
    if (has(before, row) && !has(after, row)) {
      if (next === locked) next = new Set(locked);
      next.delete(row);
    }
  }
  return next;
}

/** Ink/layout changes do not constitute a request to move the writing caret. */
export function keepSensorOnCurrentRow(input: {
  logicalLineChanged: boolean; row: number; bandStart: number; bandEnd: number; locked: ReadonlySet<number>;
}): boolean {
  return !input.logicalLineChanged && input.row >= input.bandStart && input.row <= input.bandEnd &&
    !input.locked.has(input.row) && !input.locked.has(Math.floor(input.row));
}

/** Skip only redundant leading note entries, retaining the array and every
 * saved line id/index. The first genuine equation remains the active target. */
export function firstSolutionEntry(lines: readonly {
  notebookOnly?: boolean; notebook?: string; equation?: string; fragmentStart?: number; fragmentEnd?: number; noteObjects?: unknown[];
}[], question: string): number {
  let index = 0;
  while (index < lines.length - 1) {
    const line = lines[index];
    if (!line.notebookOnly || line.equation?.trim() || (line.fragmentEnd ?? 0) > (line.fragmentStart ?? 0) || line.noteObjects?.length) break;
    if (!line.notebook?.trim() || withoutQuestionEcho(line.notebook, question).trim()) break;
    index++;
  }
  return index;
}
