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

const hasStructural = (ids: string[], byId: Map<string, Atom>): boolean =>
  ids.some((id) => {
    const a = byId.get(id);
    return !!a && STRUCTURAL_KINDS.has(a.kind);
  });

const collectBracketPartners = (nodes: Node[], out: Map<string, string>): void => {
  for (const n of nodes) {
    if (n.kind === "bracket") {
      out.set(n.open.id, n.close.id);
      out.set(n.close.id, n.open.id);
      collectBracketPartners(n.body, out);
    } else if (n.kind === "frac") {
      collectBracketPartners(n.num, out);
      collectBracketPartners(n.den, out);
    } else if (n.kind === "sqrt") {
      collectBracketPartners(n.radicand, out);
      if (n.degree) collectBracketPartners(n.degree, out);
    }
  }
};

const flatten = (nodes: Node[]): Atom[] => {
  const out: Atom[] = [];
  const walk = (ns: Node[]) => {
    for (const n of ns) {
      if (n.kind === "leaf") out.push(n.atom);
      else if (n.kind === "frac") { walk(n.num); out.push(n.bar); walk(n.den); }
      else if (n.kind === "sqrt") { out.push(n.sign); if (n.degree) walk(n.degree); walk(n.radicand); }
      else if (n.kind === "bracket") { out.push(n.open); walk(n.body); out.push(n.close); }
    }
  };
  walk(nodes);
  return out;
};

/** "Covered" = atoms that should NOT count as gaps when splitting into runs.
 *  An atom is covered if it's selected, OR it sits inside a structural node
 *  whose structural marker (bar / sign / either bracket) is selected. This
 *  lets the teacher pick the bar of a/b without forcing them to also pick A
 *  and B just to keep the run together. */
const coverageOf = (
  tree: Node[],
  selected: Set<string>,
): Set<string> => {
  const out = new Set(selected);
  const addAll = (ns: Node[]) => flatten(ns).forEach((a) => out.add(a.id));
  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      if (n.kind === "frac") {
        if (selected.has(n.bar.id)) { out.add(n.bar.id); addAll(n.num); addAll(n.den); }
        walk(n.num); walk(n.den);
      } else if (n.kind === "sqrt") {
        if (selected.has(n.sign.id)) { out.add(n.sign.id); addAll(n.radicand); if (n.degree) addAll(n.degree); }
        walk(n.radicand); if (n.degree) walk(n.degree);
      } else if (n.kind === "bracket") {
        if (selected.has(n.open.id) || selected.has(n.close.id)) {
          out.add(n.open.id); out.add(n.close.id); addAll(n.body);
        }
        walk(n.body);
      }
    }
  };
  walk(tree);
  return out;
};

/** Maximal runs of consecutive covered atoms in flat equation order. */
const consecutiveRuns = (atoms: Atom[], covered: Set<string>): string[][] => {
  const runs: string[][] = [];
  let cur: string[] = [];
  for (const a of atoms) {
    if (covered.has(a.id)) cur.push(a.id);
    else if (cur.length) { runs.push(cur); cur = []; }
  }
  if (cur.length) runs.push(cur);
  return runs;
};



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

  byIdGlobal = byId;
  bracketPartnerOf = new Map<string, string>();
  collectBracketPartners(tree, bracketPartnerOf);

  // Auto-pair brackets: selecting one side always implies the partner. The
  // UI already does this on click, but enforce it here too so programmatic
  // callers can't desync a pair.
  const expanded = new Set(selected);
  for (const id of selected) {
    const partner = bracketPartnerOf.get(id);
    if (partner) expanded.add(partner);
  }

  // Drop any prior chip the new selection touches.
  const surviving = chips.filter(
    (c) => !c.atomIds.some((id) => expanded.has(id)),
  );

  // Split into maximal consecutive runs in flat equation order.
  const runs = consecutiveRuns(atoms, expanded);


  // Build one chip per run — structural if the run contains a structural
  // atom, plain otherwise.
  const newChips: Chip[] = runs.map((run) => {
    const runSet = new Set(run);
    if (hasStructural(run, byId)) {
      const built = buildSlot(tree, runSet);
      return {
        atomIds: collectAtomIds(built),
        value: nodesToLatex(built),
        structure: built,
      };
    }
    return buildChip(byId, run);
  }).filter((c) => c.atomIds.length > 0 || c.value);

  const all = [...surviving, ...newChips];
  all.sort((a, b) => {
    const ai = a.atomIds.length ? (indexOf.get(a.atomIds[0]) ?? 1e9) : 1e9;
    const bi = b.atomIds.length ? (indexOf.get(b.atomIds[0]) ?? 1e9) : 1e9;
    return ai - bi;
  });
  return all;
};


export const swapChips = <T,>(chips: T[], a: number, b: number): T[] => {
  if (a === b || a < 0 || b < 0 || a >= chips.length || b >= chips.length) return chips;
  const next = chips.slice();
  [next[a], next[b]] = [next[b], next[a]];
  return next;
};
