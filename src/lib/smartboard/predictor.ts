// FlowBoard — Three-layer floating engine (NEW adaptive engine).
//
//   RAW       — foundation: digits, operators, variables actually in the question
//   ACTIVE    — scattered atomic pieces of the NEXT verified equation
//   STRUCTURE — only structures that the question actually uses
//
// `=` is rendered separately as a permanent left-anchored chip by SymbolStream.

import { Node } from "@/lib/mathboard/tokens";
import { nodesToAscii } from "./nodeUtils";
import type { Question } from "./linearGenerator";
import { STRUCTURES, type StructureId } from "./structures";
import { computeNextStep, computeNextStepFromMemory, scatterPieces, filterUsedPieces } from "./nextStep";

export type SuggestionGroup = "likely" | "alternative";

export interface Suggestion {
  id: string;
  label: string;
  /** ASCII to insert. Layer-3 structures use `__struct:<id>`. */
  tokensAscii: string;
  group: SuggestionGroup;
  layer: 1 | 2 | 3;
}

export interface LayeredStream {
  raw: Suggestion[];
  active: Suggestion[];
  structure: Suggestion[];
  actions: Suggestion[];
}

const ACTION_CHIPS = (): Suggestion[] => [
  { id: "save", label: "Save",          tokensAscii: "__save",  group: "likely",      layer: 2 },
  { id: "next", label: "Next question", tokensAscii: "__next",  group: "likely",      layer: 2 },
  { id: "rety", label: "Retry",         tokensAscii: "__retry", group: "alternative", layer: 2 },
];

// ---------- RAW layer ----------
const buildRaw = (question: Question): Suggestion[] => {
  const ascii = question.ascii;
  const vars = Array.from(new Set((ascii.match(/[a-zA-Z]/g) || [])));
  const out: Suggestion[] = [];
  for (let d = 0; d <= 9; d++) {
    out.push({ id: `raw-d${d}`, label: String(d), tokensAscii: String(d), group: "likely", layer: 1 });
  }
  const ops: Array<[string, string]> = [["+", "+"], ["−", "-"], ["×", "*"], ["÷", "/"]];
  ops.forEach(([disp, asc], i) => {
    out.push({ id: `raw-op${i}`, label: disp, tokensAscii: asc, group: "likely", layer: 1 });
  });
  vars.forEach((v, i) => {
    out.push({ id: `raw-v${i}`, label: v, tokensAscii: v, group: "likely", layer: 1 });
  });
  return out;
};

// ---------- ACTIVE layer (adaptive next-step) ----------
const buildActive = (
  question: Question,
  acceptedLines: Node[][],
  active: Node[],
  scatterIdx: number,
): Suggestion[] => {
  // Verified state = last accepted line (BLUE), else the original question.
  const lastVerifiedAscii =
    acceptedLines.length > 0
      ? nodesToAscii(acceptedLines[acceptedLines.length - 1])
      : question.ascii;

  const step = computeNextStepFromMemory(question.methods, lastVerifiedAscii);
  if (!step) return [];

  const activeAscii = nodesToAscii(active);
  const remaining = filterUsedPieces(step.pieces, activeAscii);
  const arranged = scatterPieces(remaining, scatterIdx);

  return arranged.map((p, i) => ({
    id: `act-${i}-${p.ascii}`,
    label: p.display,
    tokensAscii: p.ascii,
    group: "likely",
    layer: 2,
  }));
};

// ---------- STRUCTURE layer (only structures actually used) ----------
interface StructFlags {
  hasBracket: boolean; hasFrac: boolean; hasPower: boolean;
  hasRoot: boolean; hasAbs: boolean;
}
const detectStructures = (nodes: Node[]): StructFlags => {
  const f: StructFlags = { hasBracket: false, hasFrac: false, hasPower: false, hasRoot: false, hasAbs: false };
  const walk = (arr: Node[]) => {
    for (const n of arr) {
      if (n.kind === "bracket") { f.hasBracket = true; walk(n.body); }
      else if (n.kind === "frac") { f.hasFrac = true; walk(n.num); walk(n.den); }
      else if (n.kind === "power") { f.hasPower = true; walk(n.base); walk(n.exp); }
      else if (n.kind === "root") { f.hasRoot = true; walk(n.radicand); }
      else if (n.kind === "abs") { f.hasAbs = true; walk(n.body); }
    }
  };
  walk(nodes);
  return f;
};

const buildStructure = (question: Question): Suggestion[] => {
  const fq = detectStructures(question.nodes);
  const allow: Record<StructureId, boolean> = {
    paren: fq.hasBracket,
    frac:  fq.hasFrac,
    power: fq.hasPower,
    root:  fq.hasRoot,
    abs:   fq.hasAbs,
  };
  return STRUCTURES.filter((s) => allow[s.id]).map((s, i) => ({
    id: `struct-${i}-${s.id}`,
    label: s.label,
    tokensAscii: `__struct:${s.id}`,
    group: "likely",
    layer: 3,
  }));
};

// ---------- public API ----------
export const predictLayers = (
  question: Question,
  acceptedLines: Node[][],
  active: Node[],
  isComplete: boolean,
  _recent: string | null = null,
  scatterIdx: number = 0,
): LayeredStream => {
  if (isComplete) {
    return { raw: [], active: [], structure: [], actions: ACTION_CHIPS() };
  }
  return {
    raw: buildRaw(question),
    active: buildActive(question, acceptedLines, active, scatterIdx),
    structure: buildStructure(question),
    actions: [],
  };
};
