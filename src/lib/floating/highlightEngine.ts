// TEACHER HIGHLIGHT MODE engine — two independent rules.
//
// Rule 1 — Variables / numbers / operators: CONNECTIVITY.
//   Two selected atoms are connected iff every atom strictly between them is
//   also selected. Connected selection → ONE chip. Disconnected → split into
//   maximal runs of consecutive selected atoms.
//
// Rule 2 — Structures: RECONSTRUCT the mathematical object.
//   When the teacher selects any structural atom (fraction bar, root sign,
//   opening or closing bracket), the editor walks the original parsed Node
//   tree and rebuilds the structural sub-tree that owns the selection. Empty
//   slots stay as □; non-structural selected atoms inside that sub-tree drop
//   into the appropriate slot in equation order. Brackets are paired —
//   selecting either side keeps the whole pair. Nesting comes from the source
//   equation, never from click order or precedence rules.
//
// Floating Number Laws DO NOT APPLY here — those belong to AI Generation Mode.

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
  /** Serialised representation — plain text for Rule-1 chips, LaTeX for
   *  Rule-2 chips. Used as the persisted `filler` string. */
  value: string;
  /** Structural sub-tree (Rule 2 only). When set, renderers should draw this
   *  tree directly instead of parsing `value`. */
  structure?: ChipNode[];
}

export const buildChip = (atomsById: Map<string, Atom>, ids: string[]): Chip => ({
  atomIds: [...ids],
  value: ids.map((id) => atomsById.get(id)?.value ?? "").join(""),
});

/* ───────── Structure-rule helpers ───────── */

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
      s += `\\frac{${nodesToLatex(n.num)}}{${nodesToLatex(n.den)}}`;
    } else if (n.kind === "sqrt") {
      const deg = n.degree && n.degree.length ? `[${nodesToLatex(n.degree)}]` : "";
      s += `\\sqrt${deg}{${nodesToLatex(n.radicand)}}`;
    } else if (n.kind === "bracket") {
      s += n.open.value + nodesToLatex(n.body) + n.close.value;
    }

  }
  return s;
};

const buildSlot = (
  nodes: Node[],
  selected: Set<string>,
  consumed: Set<string>,
): ChipNode[] => {
  const out: ChipNode[] = [];
  for (const n of nodes) {
    if (n.kind === "leaf") {
      if (selected.has(n.atom.id)) {
        consumed.add(n.atom.id);
        out.push({ kind: "atom", atom: n.atom });
      }
    } else if (n.kind === "frac") {
      if (selected.has(n.bar.id)) {
        out.push(buildStructural(n, selected, consumed));
      } else {
        // Nested unselected fraction: harvest selected leaves only.
        const inner = buildSlot([...n.num, ...n.den], selected, consumed);
        for (const x of inner) if (x.kind !== "slot") out.push(x);
      }
    } else if (n.kind === "sqrt") {
      if (selected.has(n.sign.id)) {
        out.push(buildStructural(n, selected, consumed));
      } else {
        const inner = buildSlot([...(n.degree ?? []), ...n.radicand], selected, consumed);
        for (const x of inner) if (x.kind !== "slot") out.push(x);
      }
    } else if (n.kind === "bracket") {
      if (selected.has(n.open.id) || selected.has(n.close.id)) {
        out.push(buildStructural(n, selected, consumed));
      } else {
        const inner = buildSlot(n.body, selected, consumed);
        for (const x of inner) if (x.kind !== "slot") out.push(x);
      }
    }
  }
  if (out.length === 0) return [{ kind: "slot" }];
  return out;
};

const buildStructural = (
  node: Node,
  selected: Set<string>,
  consumed: Set<string>,
): ChipNode => {
  if (node.kind === "frac") {
    consumed.add(node.bar.id);
    return {
      kind: "frac",
      bar: node.bar,
      num: buildSlot(node.num, selected, consumed),
      den: buildSlot(node.den, selected, consumed),
    };
  }
  if (node.kind === "sqrt") {
    consumed.add(node.sign.id);
    return {
      kind: "sqrt",
      sign: node.sign,
      radicand: buildSlot(node.radicand, selected, consumed),
      degree: node.degree ? buildSlot(node.degree, selected, consumed) : undefined,
    };
  }
  if (node.kind === "bracket") {
    consumed.add(node.open.id);
    consumed.add(node.close.id);
    return {
      kind: "bracket",
      open: node.open,
      close: node.close,
      body: buildSlot(node.body, selected, consumed),
    };
  }
  // Unreachable for our caller — leaves never become structural chips.
  return { kind: "slot" };
};

const chipFromStructure = (root: ChipNode): Chip => ({
  atomIds: collectAtomIds([root]),
  value: nodesToLatex([root]),
  structure: [root],
});

const walkForStructural = (
  nodes: Node[],
  selected: Set<string>,
  out: Chip[],
  consumed: Set<string>,
): void => {
  for (const n of nodes) {
    if (n.kind === "leaf") continue;
    if (n.kind === "frac") {
      if (selected.has(n.bar.id)) {
        out.push(chipFromStructure(buildStructural(n, selected, consumed)));
      } else {
        walkForStructural(n.num, selected, out, consumed);
        walkForStructural(n.den, selected, out, consumed);
      }
    } else if (n.kind === "sqrt") {
      if (selected.has(n.sign.id)) {
        out.push(chipFromStructure(buildStructural(n, selected, consumed)));
      } else {
        if (n.degree) walkForStructural(n.degree, selected, out, consumed);
        walkForStructural(n.radicand, selected, out, consumed);
      }
    } else if (n.kind === "bracket") {
      if (selected.has(n.open.id) || selected.has(n.close.id)) {
        out.push(chipFromStructure(buildStructural(n, selected, consumed)));
      } else {
        walkForStructural(n.body, selected, out, consumed);
      }
    }
  }
};

/* ───────── Rule 1: connectivity runs ───────── */

const connectivityRuns = (
  atoms: Atom[],
  selected: Set<string>,
): string[][] => {
  const selectedIdx: number[] = [];
  atoms.forEach((a, i) => { if (selected.has(a.id)) selectedIdx.push(i); });
  if (selectedIdx.length === 0) return [];
  const first = selectedIdx[0];
  const last = selectedIdx[selectedIdx.length - 1];
  const span = atoms.slice(first, last + 1);
  const fullyConnected = span.every((a) => selected.has(a.id));
  const runs: string[][] = [];
  if (fullyConnected) {
    runs.push(span.map((a) => a.id));
  } else {
    let cur: string[] = [];
    for (const a of atoms) {
      if (selected.has(a.id)) cur.push(a.id);
      else if (cur.length) { runs.push(cur); cur = []; }
    }
    if (cur.length) runs.push(cur);
  }
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

  // Rule 2 — structural chips.
  const consumed = new Set<string>();
  const structuralChips: Chip[] = [];
  walkForStructural(tree, selected, structuralChips, consumed);

  // Rule 1 — connectivity on whatever's left.
  const remaining = new Set<string>();
  for (const id of selected) if (!consumed.has(id)) remaining.add(id);
  const variableRuns = connectivityRuns(atoms, remaining);
  const variableChips = variableRuns.map((ids) => buildChip(byId, ids));

  // Residual chips: surviving (unselected) halves of overlapped existing chips.
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
  const residualChips = residualRuns.map((ids) => buildChip(byId, ids));

  // Combine, order by first-atom equation index, dedupe by atom-id signature.
  const all = [...surviving, ...structuralChips, ...variableChips, ...residualChips];
  all.sort((a, b) => {
    const ai = a.atomIds.length ? (indexOf.get(a.atomIds[0]) ?? 1e9) : 1e9;
    const bi = b.atomIds.length ? (indexOf.get(b.atomIds[0]) ?? 1e9) : 1e9;
    return ai - bi;
  });
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
