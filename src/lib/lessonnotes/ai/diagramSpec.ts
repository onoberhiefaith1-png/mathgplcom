// AI Mathematical Diagram Engine — builds diagrams from mathematical meaning.
//
// The AI never asks the Asset Library for a mathematical diagram. It writes a
// spec (type + data) and this module constructs the native, editable engine
// model (Venn / Tree / Flowchart). Geometry and 3D solids are constructed by
// the existing geometry and solid builders in materializeDirectives.

import { buildVennPreset } from "@/components/lessonnotes/extensions/visuals/vennEngine/presets";
import type { RegionOverride, UCEVennModel } from "@/components/lessonnotes/extensions/visuals/vennEngine/types";
import { DEFAULT_BRANCH, newNodeId, type TreeModel, type TreeNode } from "@/components/lessonnotes/extensions/visuals/treeEngine/types";
import { makeFlowNode, type FlowEdge, type FlowModel, type FlowNode } from "@/components/lessonnotes/extensions/visuals/flowchartEngine/types";

type P = Record<string, string | undefined>;

export type DiagramFamily = "venn" | "tree" | "flowchart" | "geometry" | "solid" | null;

const SOLIDS = [
  "cube", "cuboid", "cylinder", "cone", "sphere", "hemisphere", "prism", "pyramid",
  "squarepyramid", "triangularprism", "triangularpyramid", "frustum", "net",
];

const GEOMETRY = [
  "line", "segment", "ray", "angle", "parallel", "perpendicular", "transversal", "intersecting",
  "triangle", "equilateral", "isosceles", "scalene", "quadrilateral", "square", "rectangle",
  "parallelogram", "rhombus", "kite", "trapezium", "trapezoid", "polygon", "pentagon", "hexagon",
  "octagon", "circle", "radius", "diameter", "chord", "arc", "sector", "segment", "semicircle",
  "quadrant", "tangent", "secant", "concentric", "cyclic", "inscribed", "geometry",
];

/** Decide which engine constructs a requested diagram. */
export function classifyDiagram(raw: string): DiagramFamily {
  const k = (raw || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!k) return null;
  if (/venn|^sets?$|setdiagram|union|intersection|complement/.test(k)) return "venn";
  if (/tree|probabilitytree|outcomes/.test(k)) return "tree";
  if (/flow|algorithm|process|decision(chart)?$/.test(k)) return "flowchart";
  if (SOLIDS.some((s) => k.includes(s)) || /solid|3d/.test(k)) return "solid";
  if (GEOMETRY.some((g) => k.includes(g))) return "geometry";
  return null;
}

/* --------------------------------- Venn ---------------------------------- */

export interface VennRegions {
  /** Region key → value. "A" = A only, "AB" = A∩B only, "" = neither. */
  [key: string]: number;
}

const num = (v: string | undefined): number | null => {
  if (v == null || v.trim() === "") return null;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : null;
};

/**
 * Solve the regions of a two-set Venn diagram from the facts in a question.
 * Accepts totals (total, A, B, AB) and/or region counts (aOnly, bOnly, neither).
 */
export function solveTwoSetVenn(p: P): VennRegions | null {
  const total = num(p.total ?? p.universe ?? p.U);
  const a = num(p.A ?? p.a ?? p.nA);
  const b = num(p.B ?? p.b ?? p.nB);
  let ab = num(p.AB ?? p.both ?? p.intersection ?? p.nAB);
  let aOnly = num(p.aOnly ?? p.Aonly);
  let bOnly = num(p.bOnly ?? p.Bonly);
  let neither = num(p.neither ?? p.outside);

  if (ab == null && a != null && aOnly != null) ab = a - aOnly;
  if (ab == null && b != null && bOnly != null) ab = b - bOnly;
  if (ab == null && total != null && a != null && b != null && neither != null) ab = a + b + neither - total;
  if (ab == null) return null;
  if (aOnly == null && a != null) aOnly = a - ab;
  if (bOnly == null && b != null) bOnly = b - ab;
  if (neither == null && total != null && aOnly != null && bOnly != null) neither = total - aOnly - bOnly - ab;
  if (aOnly == null || bOnly == null) return null;
  const out: VennRegions = { A: aOnly, AB: ab, B: bOnly };
  if (neither != null) out[""] = neither;
  if (Object.values(out).some((v) => v < 0)) return null;
  return out;
}

/** Region keys shaded by a set operation, for a two- or three-set diagram. */
export function regionsForOperation(op: string, numSets: 2 | 3): string[] {
  const all = numSets === 2 ? ["A", "B", "AB", ""] : ["A", "B", "C", "AB", "AC", "BC", "ABC", ""];
  const has = (k: string, s: string) => k.includes(s);
  const o = (op || "").replace(/\s+/g, "").replace(/∩|\^|n(?=[A-C])/g, "&").replace(/∪|u(?=[A-C])/gi, "|");
  const m = o.match(/^([A-C])('|c)?(?:([&|\-\\])([A-C])('|c)?)?$/i);
  if (!m) return [];
  const [, x, xc, opr, y, yc] = m;
  const inX = (k: string) => (xc ? !has(k, x.toUpperCase()) : has(k, x.toUpperCase()));
  const inY = (k: string) => (yc ? !has(k, (y ?? "").toUpperCase()) : has(k, (y ?? "").toUpperCase()));
  if (!opr) return all.filter(inX);
  if (opr === "&") return all.filter((k) => inX(k) && inY(k));
  if (opr === "|") return all.filter((k) => inX(k) || inY(k));
  return all.filter((k) => inX(k) && !inY(k));
}

export function buildVennModel(p: P): UCEVennModel {
  const labels = (p.sets ?? p.labels ?? "A,B").split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
  const three = labels.length >= 3 || p.numSets === "3";
  const rel = (p.relation ?? p.layout ?? "").toLowerCase();
  const preset = three ? "venn3" : /disjoint|separate|nooverlap/.test(rel) ? "vennDisjoint" : "venn2";
  const model = buildVennPreset(preset);
  model.presetId = "generated";
  model.sets = model.sets.map((s, i) => ({ ...s, label: labels[i] ?? s.id }));
  model.universe = { ...model.universe, show: true };

  const regions = new Map<string, RegionOverride>();
  const put = (key: string, patch: Partial<RegionOverride>) => {
    const r = regions.get(key) ?? { key, text: "", fill: "none", fillOpacity: 0 };
    regions.set(key, { ...r, ...patch });
  };

  const showValues = (p.stage ?? "solution").toLowerCase() !== "question";
  if (showValues) {
    const solved = three ? null : solveTwoSetVenn(p);
    if (solved) {
      for (const [k, v] of Object.entries(solved)) put(k, { text: String(v) });
    }
    // Explicit region values always win (e.g. regions="A:15,AB:10,B:8,:7").
    for (const part of (p.regions ?? "").split(",")) {
      const [k, v] = part.split(":");
      if (v != null && v.trim() !== "") put((k ?? "").trim().toUpperCase(), { text: v.trim() });
    }
  }
  const op = p.shade ?? p.operation ?? p.op;
  if (op) {
    for (const k of regionsForOperation(op, three ? 3 : 2)) put(k, { fill: "#f59e0b", fillOpacity: 0.45 });
  }
  model.regions = [...regions.values()];
  return model;
}

/* --------------------------------- Tree ---------------------------------- */

function tnode(label: string, prob = "", children: TreeNode[] = []): TreeNode {
  return {
    id: newNodeId(), label, prob: "", expr: "", color: "#111827", size: 18, revealed: true,
    branch: { ...DEFAULT_BRANCH(), prob }, children,
  };
}

/**
 * stages="H,T;H,T" (one group per event), probs="1/2,1/2;1/2,1/2".
 * The last level lists every combined outcome (HH, HT, TH, TT).
 */
export function buildTreeModel(p: P): TreeModel {
  const stages = (p.stages ?? p.events ?? p.outcomes ?? "H,T;H,T")
    .split(";").map((s) => s.split(",").map((x) => x.trim()).filter(Boolean)).filter((s) => s.length);
  const probs = (p.probs ?? p.probabilities ?? "")
    .split(";").map((s) => s.split(",").map((x) => x.trim()));
  const showProbs = (p.stage ?? "solution").toLowerCase() !== "question";
  const grow = (level: number, path: string[]): TreeNode[] => {
    if (level >= stages.length) return [];
    return stages[level].map((label, i) => {
      const next = [...path, label];
      const n = tnode(label, showProbs ? probs[level]?.[i] ?? "" : "", grow(level + 1, next));
      if (level === stages.length - 1) n.expr = next.join("");
      return n;
    });
  };
  return {
    root: tnode(p.root ?? "Start", "", grow(0, [])),
    direction: p.direction === "LR" ? "LR" : "TB",
    defaults: { color: "#111827", size: 18, thickness: 1.5, arrow: false },
  };
}

/** Every outcome at the leaves of a tree, left to right. */
export function treeOutcomes(m: TreeModel): string[] {
  const out: string[] = [];
  const walk = (n: TreeNode) => (n.children.length ? n.children.forEach(walk) : out.push(n.expr || n.label));
  m.root.children.forEach(walk);
  return out;
}

/* ------------------------------- Flowchart ------------------------------- */

/**
 * steps="Start; Input n; ?Is n ÷ 2 a whole number?|Even|Odd; End".
 * "?Q|yes|no" is a decision whose two branches rejoin at the next step.
 * "Input…/Output…/Print…" become input/output boxes.
 */
export function buildFlowModel(p: P): FlowModel {
  const steps = (p.steps ?? "Start; Process; End").split(";").map((s) => s.trim()).filter(Boolean);
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  let y = 30;
  let tails: { id: string; label: string }[] = [];
  const link = (to: string) => {
    for (const t of tails) edges.push({ id: `e${edges.length + 1}`, from: t.id, to, style: "orthogonal", arrow: true, label: t.label });
  };
  steps.forEach((raw, i) => {
    if (raw.startsWith("?")) {
      const [q, yes = "Yes", no = "No"] = raw.slice(1).split("|").map((s) => s.trim());
      const d = { ...makeFlowNode("decision", 190, y), text: q };
      nodes.push(d); link(d.id); y += d.h + 50;
      const a = { ...makeFlowNode("process", 40, y), text: yes };
      const b = { ...makeFlowNode("process", 340, y), text: no };
      nodes.push(a, b);
      edges.push({ id: `e${edges.length + 1}`, from: d.id, to: a.id, style: "orthogonal", arrow: true, label: "Yes" });
      edges.push({ id: `e${edges.length + 1}`, from: d.id, to: b.id, style: "orthogonal", arrow: true, label: "No" });
      tails = [{ id: a.id, label: "" }, { id: b.id, label: "" }];
      y += a.h + 50;
      return;
    }
    const lower = raw.toLowerCase();
    const kind = i === 0 && /^start|^begin/.test(lower) ? "start"
      : /^(end|stop)\b/.test(lower) ? "end"
      : /^(input|output|print|read|display)\b/.test(lower) ? "io" : "process";
    const n = { ...makeFlowNode(kind, kind === "start" || kind === "end" ? 200 : 190, y), text: raw };
    nodes.push(n); link(n.id);
    tails = [{ id: n.id, label: "" }];
    y += n.h + 50;
  });
  return { nodes, edges, layout: "free", canvas: { w: 520, h: Math.max(340, y + 20) } };
}

/* ------------------------------- Node shape ------------------------------ */

export function engineVisualNode(family: "vennEngine" | "treeEngine" | "flowchartEngine", model: unknown) {
  return {
    type: "paragraph",
    content: [{ type: "mathVisual", attrs: { family, attrs: { variant: "generated", model } } }],
  };
}
