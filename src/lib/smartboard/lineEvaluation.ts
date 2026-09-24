/**
 * One authoritative line result for the teacher's Evaluation panel.
 * The mark and the report derive from the same state: an awarded line is
 * always Equivalent, and a failed/retrying check never replaces a verdict.
 */
export type LineStatus = "equivalent" | "not_equivalent" | "incomplete" | "pending" | "empty";

export interface LineCheck {
  questionId: string;
  lineId: string;
  correct: boolean;
  verdict?: string | null;
  studentAscii?: string;
}

const norm = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, "");

export const lineKey = (q: string, l: string) => `${q}:${l}`;

/** Merge an incoming check into the per-line store. Errors never overwrite. */
export function mergeLineCheck<T extends LineCheck>(store: Record<string, T>, incoming: T): Record<string, T> {
  const key = lineKey(incoming.questionId, incoming.lineId);
  const prev = store[key];
  if (incoming.verdict === "error") {
    if (prev && prev.verdict !== "error") return store;
  }
  // An already-proved equivalence for the same expression is never downgraded.
  if (prev?.correct && !incoming.correct && norm(prev.studentAscii) === norm(incoming.studentAscii)) return store;
  return { ...store, [key]: incoming };
}

export function deriveLineStatus(input: {
  awardedMarks: number;
  check: LineCheck | null | undefined;
  studentAscii: string;
}): LineStatus {
  if (input.awardedMarks > 0) return "equivalent";
  const student = norm(input.studentAscii);
  if (!student) return "empty";
  const c = input.check;
  if (!c || c.verdict === "error") return "pending";
  if (c.studentAscii != null && norm(c.studentAscii) !== student) return "pending";
  if (c.correct) return "equivalent";
  if (c.verdict === "incomplete") return "incomplete";
  return "not_equivalent";
}
