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

/** Keep the ask cheap: permutations only near the end, never many at once. */
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
 *
 * While many pieces are still unplaced the ask stays down to the two ORDERED
 * completions (the teacher's own atom order), so the look-ahead runs from the
 * very first piece a student places instead of waking up only near the end.
 * That is what makes the mark land on the finishing keystroke on every screen
 * — assigned work, shared links, Academia Practice and Play alike.
 */
export const completionCandidates = (input: {
  studentAscii: string;
  atoms: readonly string[];
  limit?: number;
}): string[] => {
  const student = clean(input.studentAscii);

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

  // THE LINE AS IT STANDS IS ALWAYS ASKED FIRST. A student who writes the
  // correct mathematics in their own order (or types it rather than tapping
  // the pieces) is then marked on the very keystroke that completes it,
  // instead of waiting for a route built out of the remaining pieces.
  if (student) add(student);

  // WARM-UP. With nothing written yet the candidates are the lines the given
  // Floating Numbers can build in their own order. Asking them before the
  // student starts means the accepted answer is already on the device, so the
  // finishing keystroke is marked with no request at all — the same instant
  // feel as the teacher's test board, on assigned work, shared links and
  // Academia Practice and Play alike.
  const pool = remainingAtoms(input.atoms, student);
  if (pool.length > 0) {
    const orders = pool.length > MAX_PRECLEAR_REMAINING ? [[...pool]] : permutations(pool);
    for (const order of orders) {
      if (!student) { add(order.join(" ")); continue; }
      add([student, ...order].join(" "));
      add([...order, student].join(" "));
    }
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
