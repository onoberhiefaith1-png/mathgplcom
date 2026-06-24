// TEACHER HIGHLIGHT MODE engine.
//
// IMPORTANT: this engine is for the Teacher Highlight workflow ONLY.
// It deliberately does NOT apply the Floating Number Laws (those laws live in
// the AI Generation pipeline). Teacher intent is the truth here:
//   - whatever the teacher selects becomes the Floating Number(s)
//   - connected selection  → one chip
//   - disconnected selection → multiple chips
//   - structures-only selection (brackets, fraction-bar, root-sign, exponent,
//     subscript) → merged into ONE chip even when non-contiguous, so
//     selecting `(` and `)` in `(A+B)` yields a single `( )` Floating Number

import type { Atom, AtomKind } from "./atoms";

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

const STRUCTURE_KINDS = new Set<AtomKind>([
  "bracket-open", "bracket-close", "fraction-bar", "root-sign", "exponent", "subscript",
]);

export const applySelection = (
  atoms: Atom[],
  chips: Chip[],
  selected: Set<string>,
): Chip[] => {
  if (selected.size === 0) return chips;
  const indexOf = new Map<string, number>();
  atoms.forEach((a, i) => indexOf.set(a.id, i));
  const byId = new Map<string, Atom>(atoms.map((a) => [a.id, a]));

  const selectedOrdered = atoms.filter((a) => selected.has(a.id));
  const allStructures =
    selectedOrdered.length > 1 &&
    selectedOrdered.every((a) => STRUCTURE_KINDS.has(a.kind));

  // 1. Group selection by contiguity (or merge if all-structures).
  const runs: string[][] = [];
  if (allStructures) {
    runs.push(selectedOrdered.map((a) => a.id));
  } else {
    let cur: string[] = [];
    for (const a of atoms) {
      if (selected.has(a.id)) cur.push(a.id);
      else if (cur.length) { runs.push(cur); cur = []; }
    }
    if (cur.length) runs.push(cur);
  }

  // 2. Drop existing chips that overlap; surviving unselected atoms of split
  //    chips become residual chips.
  const residualRuns: string[][] = [];
  const surviving: Chip[] = [];
  for (const ch of chips) {
    const overlaps = ch.atomIds.some((id) => selected.has(id));
    if (!overlaps) { surviving.push(ch); continue; }
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

  // 3. New chips.
  const newChips: Chip[] = [...runs, ...residualRuns].map((ids) => buildChip(byId, ids));

  // 4. Order by first-atom index.
  const all = [...surviving, ...newChips];
  all.sort((a, b) => {
    const ai = a.atomIds.length ? (indexOf.get(a.atomIds[0]) ?? 1e9) : 1e9;
    const bi = b.atomIds.length ? (indexOf.get(b.atomIds[0]) ?? 1e9) : 1e9;
    return ai - bi;
  });

  // 5. Dedupe.
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

/** Teacher reorder: swap two chips by index. */
export const swapChips = <T,>(chips: T[], a: number, b: number): T[] => {
  if (a === b || a < 0 || b < 0 || a >= chips.length || b >= chips.length) return chips;
  const next = chips.slice();
  [next[a], next[b]] = [next[b], next[a]];
  return next;
};
