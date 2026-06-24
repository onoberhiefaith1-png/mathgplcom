// Highlight Generation engine — the one rule that powers manual generation,
// AI correction, merge, and split. Given the current atom list of an equation,
// the current chips, and a selected set of atom ids, returns the next chips:
//
//   1. Remove every existing chip that overlaps the selected atoms.
//   2. Build new chips from the selection by splitting at contiguity gaps in
//      the original equation order (disconnected selection → multiple chips).
//   3. Return the remaining + new chips in equation order. No duplicates.

import type { Atom } from "./atoms";

export interface Chip {
  /** Atom ids this chip was built from, in equation order. */
  atomIds: string[];
  /** Display text (concatenation of atom values). */
  value: string;
}

export const buildChip = (atomsById: Map<string, Atom>, ids: string[]): Chip => ({
  atomIds: [...ids],
  value: ids.map((id) => atomsById.get(id)?.value ?? "").join(""),
});

export const applySelection = (
  atoms: Atom[],
  chips: Chip[],
  selected: Set<string>,
): Chip[] => {
  if (selected.size === 0) return chips;
  const indexOf = new Map<string, number>();
  atoms.forEach((a, i) => indexOf.set(a.id, i));
  const byId = new Map<string, Atom>(atoms.map((a) => [a.id, a]));

  // 1. Contiguous runs of selected atoms in equation order.
  const runs: string[][] = [];
  let cur: string[] = [];
  for (const a of atoms) {
    if (selected.has(a.id)) cur.push(a.id);
    else if (cur.length) { runs.push(cur); cur = []; }
  }
  if (cur.length) runs.push(cur);

  // 2. Drop existing chips that overlap selection (split/merge happens here).
  //    Also collect their atoms that the teacher did NOT select — those must
  //    survive as residual chips so a partial split keeps the remainder
  //    (e.g. [Ax²] + select "A" → [A] + [x²]).
  const residualRuns: string[][] = [];
  const surviving: Chip[] = [];
  for (const ch of chips) {
    const overlaps = ch.atomIds.some((id) => selected.has(id));
    if (!overlaps) { surviving.push(ch); continue; }
    // Split the chip's atoms on the boundary between selected and unselected.
    let buf: string[] = [];
    for (const id of ch.atomIds) {
      if (selected.has(id)) {
        if (buf.length) { residualRuns.push(buf); buf = []; }
      } else {
        buf.push(id);
      }
    }
    if (buf.length) residualRuns.push(buf);
  }

  // 3. Build new chips from selection runs + residual runs.
  const newChips: Chip[] = [...runs, ...residualRuns].map((ids) => buildChip(byId, ids));

  // 4. Order everything by first-atom index in the equation.
  const all = [...surviving, ...newChips];
  all.sort((a, b) => {
    const ai = a.atomIds.length ? (indexOf.get(a.atomIds[0]) ?? 1e9) : 1e9;
    const bi = b.atomIds.length ? (indexOf.get(b.atomIds[0]) ?? 1e9) : 1e9;
    return ai - bi;
  });

  // 5. Defensive dedupe: identical atomIds signature → keep first.
  const seen = new Set<string>();
  const out: Chip[] = [];
  for (const c of all) {
    const sig = c.atomIds.join("|");
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(c);
  }
  return out;
};
