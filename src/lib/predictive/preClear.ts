// PRE-CLEARANCE — the student board's half of the predictive engine when the
// expected line is deliberately server-side only (assessment / Game play).
//
// The board cannot prove equivalence locally there, because the answer key
// never reaches the device. So instead of waiting for the student to finish and
// THEN asking the marking service, the board asks ahead: "of these possible
// completions of the line I am building, which would be correct?" The marking
// service answers with the accepted strings only — never the expected line.
// When the student then places the final piece, the match is already known and
// the mark lands on that same tick.
//
// This adds NO mathematics: the accepted set comes from the one authoritative
// marking service, which still re-marks and reconciles in the background.

import { normEq } from "@/lib/smartboard/rowAscii";
import { remainingAtoms } from "./predictiveLine";

/** Keep the ask cheap: only near the end of the line, and never many at once. */
export const MAX_PRECLEAR_REMAINING = 3;
export const MAX_PRECLEAR_CANDIDATES = 8;

const clean = (v: string | null | undefined) => String(v ?? "").trim();

const permutations = (items: readonly string[]): string[][] => {
  if (items.length <= 1) return [[...items]];
  const out: string[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permutations(rest)) out.push([items[i], ...tail]);
  }
  return out;
};

/**
 * Every completion the remaining Floating Numbers could still produce from the
 * student's current construction — the student's text with the remaining atoms
 * appended, and (for a student who started mid-line) prepended.
 */
export const completionCandidates = (input: {
  studentAscii: string;
  atoms: readonly string[];
  limit?: number;
}): string[] => {
  const student = clean(input.studentAscii);
  if (!student) return [];
  const pool = remainingAtoms(input.atoms, student);
  if (pool.length === 0) return [student];
  if (pool.length > MAX_PRECLEAR_REMAINING) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  const add = (value: string) => {
    const text = clean(value);
    if (!text) return;
    const key = normEq(text);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(text);
  };

  for (const order of permutations(pool)) {
    add([student, ...order].join(" "));
    add([...order, student].join(" "));
  }
  return out.slice(0, input.limit ?? MAX_PRECLEAR_CANDIDATES);
};

/** Pre-cleared lines, remembered per line so one ask serves every keystroke. */
export class PreClearedLines {
  private accepted = new Map<string, Set<string>>();
  private asked = new Map<string, Set<string>>();

  /** Which of these candidates have not been sent for this line yet. */
  unasked(slotKey: string, candidates: readonly string[]): string[] {
    const already = this.asked.get(slotKey) ?? new Set<string>();
    return candidates.filter((c) => !already.has(normEq(c)));
  }

  markAsked(slotKey: string, candidates: readonly string[]): void {
    const set = this.asked.get(slotKey) ?? new Set<string>();
    for (const c of candidates) set.add(normEq(c));
    this.asked.set(slotKey, set);
  }

  accept(slotKey: string, cleared: readonly string[]): void {
    const set = this.accepted.get(slotKey) ?? new Set<string>();
    for (const c of cleared) set.add(normEq(c));
    this.accepted.set(slotKey, set);
  }

  /** True when the marking service has ALREADY approved exactly this line. */
  isCleared(slotKey: string, studentAscii: string): boolean {
    const set = this.accepted.get(slotKey);
    if (!set) return false;
    const key = normEq(clean(studentAscii));
    return key.length > 0 && set.has(key);
  }

  reset(slotKey?: string): void {
    if (!slotKey) { this.accepted.clear(); this.asked.clear(); return; }
    this.accepted.delete(slotKey);
    this.asked.delete(slotKey);
  }
}
