// TEACHER HIGHLIGHT MODE — Editor, not AI.
//
// THE RULE: connectivity over the flat atom sequence.
//   • Consecutive selected atoms → one Floating Number.
//   • A gap in the selection → a new Floating Number.
//   • Whatever the teacher selects + presses Enter is a Floating Number;
//     the system only decides which clicks belong together (= no gap between
//     them in the source equation).
//
// Structures are atoms too. If the teacher's run includes the fraction bar,
// the root sign, or a bracket, the chip is rebuilt as the real mathematical
// object (\frac, \sqrt, paired brackets) with □ for any slot the teacher
// didn't fill. If the teacher selects A and B but skips the bar, the bar is
// the gap — two plain chips [A] and [B], not a fraction.
//
// No Floating Number Laws here — those belong to AI Generation Mode.


import type { Atom, Node } from "./atoms";

export type ChipNode =
  | { kind: "atom"; atom: Atom }
  | { kind: "slot" }
  | { kind: "frac"; bar: Atom; num: ChipNode[]; den: ChipNode[] }
  | { kind: "sqrt"; sign: Atom; radicand: ChipNode[]; degree?: ChipNode[] }
  | { kind: "bracket"; open: Atom; close: Atom; body: ChipNode[] };

export interface Chip {
  /** Atom ids this chip was built from, in equation order. */
  atomIds: string[];
  /** Persisted string — LaTeX when the chip has structure, plain text otherwise. */
  value: string;
  /** Structural sub-tree (only present when the teacher selected at least one
   *  structural atom). Renderers should draw this instead of parsing `value`. */
  structure?: ChipNode[];
}

export const buildChip = (atomsById: Map<string, Atom>, ids: string[]): Chip => ({
  atomIds: [...ids],
  value: ids.map((id) => atomsById.get(id)?.value ?? "").join(""),
});

/* ───────── Structural reconstruction ───────── */

const STRUCTURAL_KINDS = new Set([
  "fraction-bar",
  "root-sign",
  "bracket-open",
  "bracket-close",
]);

const collectAtomIds = (nodes: ChipNode[]): string[] => {
  const out: string[] = [];
  for (const n of nodes) {
    if (n.kind === "atom") out.push(n.atom.id);
    else if (n.kind === "slot") { /* no atom */ }
    else if (n.kind === "frac") {
      out.push(...collectAtomIds(n.num));
      out.push(n.bar.id);
      out.push(...collectAtomIds(n.den));
    } else if (n.kind === "sqrt") {
      out.push(n.sign.id);
      if (n.degree) out.push(...collectAtomIds(n.degree));
      out.push(...collectAtomIds(n.radicand));
    } else if (n.kind === "bracket") {
      out.push(n.open.id);
      out.push(...collectAtomIds(n.body));
      out.push(n.close.id);
    }
  }
  return out;
};

const nodesToLatex = (nodes: ChipNode[]): string => {
  let s = "";
  for (const n of nodes) {
    if (n.kind === "atom") s += n.atom.value;
    else if (n.kind === "slot") s += "□";
    else if (n.kind === "frac") {
      const num = nodesToLatex(n.num) || "□";
      const den = nodesToLatex(n.den) || "□";
      s += `\\frac{${num}}{${den}}`;
    } else if (n.kind === "sqrt") {
      const rad = nodesToLatex(n.radicand) || "□";
      const deg = n.degree && n.degree.length ? `[${nodesToLatex(n.degree)}]` : "";
      s += `\\sqrt${deg}{${rad}}`;
    } else if (n.kind === "bracket") {
      s += n.open.value + (nodesToLatex(n.body) || "□") + n.close.value;
    }
  }
  return s;
};

/** Walk a slot's source nodes and emit ChipNodes for everything the teacher
 *  selected. Structural nodes survive iff their structural marker is selected;
 *  otherwise their children flatten into the parent in equation order. */
const buildSlot = (nodes: Node[], selected: Set<string>): ChipNode[] => {
  const out: ChipNode[] = [];
  for (const n of nodes) {
    if (n.kind === "leaf") {
      if (selected.has(n.atom.id)) out.push({ kind: "atom", atom: n.atom });
    } else if (n.kind === "frac") {
      if (selected.has(n.bar.id)) {
        out.push({
          kind: "frac",
          bar: n.bar,
          num: emptyToSlot(buildSlot(n.num, selected)),
          den: emptyToSlot(buildSlot(n.den, selected)),
        });
      } else {
        out.push(...buildSlot(n.num, selected));
        out.push(...buildSlot(n.den, selected));
      }
    } else if (n.kind === "sqrt") {
      if (selected.has(n.sign.id)) {
        out.push({
          kind: "sqrt",
          sign: n.sign,
          radicand: emptyToSlot(buildSlot(n.radicand, selected)),
          degree: n.degree ? buildSlot(n.degree, selected) : undefined,
        });
      } else {
        if (n.degree) out.push(...buildSlot(n.degree, selected));
        out.push(...buildSlot(n.radicand, selected));
      }
    } else if (n.kind === "bracket") {
      if (selected.has(n.open.id) || selected.has(n.close.id)) {
        out.push({
          kind: "bracket",
          open: n.open,
          close: n.close,
          body: emptyToSlot(buildSlot(n.body, selected)),
        });
      } else {
        out.push(...buildSlot(n.body, selected));
      }
    }
  }
  return out;
};

const emptyToSlot = (nodes: ChipNode[]): ChipNode[] =>
  nodes.length === 0 ? [{ kind: "slot" }] : nodes;

const hasStructural = (atoms: Atom[], selected: Set<string>): boolean =>
  atoms.some((a) => selected.has(a.id) && STRUCTURAL_KINDS.has(a.kind));

/* ───────── Public API ───────── */

export const applySelection = (
  tree: Node[],
  atoms: Atom[],
  chips: Chip[],
  selected: Set<string>,
): Chip[] => {
  if (selected.size === 0) return chips;

  const indexOf = new Map<string, number>();
  atoms.forEach((a, i) => indexOf.set(a.id, i));
  const byId = new Map<string, Atom>(atoms.map((a) => [a.id, a]));

  // Build the single new chip — structural or plain.
  let newChip: Chip;
  if (hasStructural(atoms, selected)) {
    const built = buildSlot(tree, selected);
    newChip = {
      atomIds: collectAtomIds(built),
      value: nodesToLatex(built),
      structure: built,
    };
  } else {
    const ids: string[] = [];
    for (const a of atoms) if (selected.has(a.id)) ids.push(a.id);
    newChip = buildChip(byId, ids);
  }
  if (newChip.atomIds.length === 0 && !newChip.value) return chips;

  // Drop any prior chip the new selection overlaps — the teacher just
  // re-claimed those atoms for a new Floating Number.
  const surviving = chips.filter(
    (c) => !c.atomIds.some((id) => selected.has(id)),
  );

  const all = [...surviving, newChip];
  all.sort((a, b) => {
    const ai = a.atomIds.length ? (indexOf.get(a.atomIds[0]) ?? 1e9) : 1e9;
    const bi = b.atomIds.length ? (indexOf.get(b.atomIds[0]) ?? 1e9) : 1e9;
    return ai - bi;
  });
  return all;
};

/** Teacher reorder: swap two chips by index. */
export const swapChips = <T,>(chips: T[], a: number, b: number): T[] => {
  if (a === b || a < 0 || b < 0 || a >= chips.length || b >= chips.length) return chips;
  const next = chips.slice();
  [next[a], next[b]] = [next[b], next[a]];
  return next;
};
