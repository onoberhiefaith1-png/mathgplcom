// Materializer — turns AI tool directives into REAL editable workspace nodes.
//
// The AI writes directives such as
//     [[tool:smartTable headers="x | f" rows="1 | 2 ; 3 | 4"]]
// and this module converts them into the exact TipTap nodes the toolbar
// buttons produce, so every AI-created object is fully editable and
// identical to one a teacher inserted by hand.
//
// Anything that cannot be resolved degrades to plain text — never a broken
// node (the fallback rule).

import { resolveAsset } from "./toolManifest";
import { requiredSlotCount, validateStructure } from "@/lib/lessonnotes/structureValidator";
import { DEFAULT_GRAPH } from "@/components/lessonnotes/extensions/SmartGraph";
import {
  EMPTY_SCENE_3D,
  SOLID_DEFS,
  createSolid,
  type Solid3DKind,
} from "@/lib/geometry3d/scene3d";

type TipTapNode = any;

export interface Directive {
  tool: string;
  params: Record<string, string>;
  raw: string;
}

export const DIRECTIVE_RE = /\[\[tool:([a-zA-Z0-9_]+)([^\]]*)\]\]/g;

/** Parse `key="value"` / `key=value` pairs. */
function parseParams(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z0-9_]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    out[m[1]] = (m[2] ?? m[3] ?? m[4] ?? "").trim();
  }
  return out;
}

export function parseDirective(tool: string, rest: string, raw: string): Directive {
  return { tool, params: parseParams(rest), raw };
}

const splitList = (s: string | undefined, sep = "|") =>
  (s ?? "")
    .split(sep)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);

const num = (v: string | undefined, d: number) =>
  Number.isFinite(Number(v)) ? Number(v) : d;

/* ------------------------------ Smart Table ------------------------------ */

function smartTableNode(p: Record<string, string>): TipTapNode {
  const headers = splitList(p.headers ?? p.cols);
  const rowSpecs = (p.rows ?? "")
    .split(";")
    .map((r) => r.trim())
    .filter(Boolean);
  const cells = rowSpecs.map((r) => splitList(r));
  const cols = Math.max(headers.length, ...cells.map((c) => c.length), num(p.cols, 0), 2);
  const rows = Math.max(cells.length, num(p.rowCount, 0), 1);
  const grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => cells[r]?.[c] ?? ""),
  );
  const head = Array.from({ length: cols }, (_, c) => headers[c] ?? "");
  return {
    type: "paragraph",
    content: [
      {
        type: "mathVisual",
        attrs: {
          family: "smarttable",
          attrs: { rows, cols, headers: head, cells: grid },
        },
      },
    ],
  };
}

/* -------------------------------- Graph ---------------------------------- */

/** Safe sampler for simple y = f(x) expressions. */
function sampleEquation(expr: string, xMin: number, xMax: number, step: number) {
  const cleaned = expr
    .replace(/^\s*y\s*=\s*/i, "")
    .replace(/\^/g, "**")
    .replace(/(\d)\s*([a-z(])/gi, "$1*$2");
  if (!/^[-+*/(). \d\sxa-z*]+$/i.test(cleaned)) return [];
  let fn: (x: number) => number;
  try {
    // eslint-disable-next-line no-new-func
    fn = new Function(
      "x",
      `"use strict"; const {sin,cos,tan,sqrt,abs,log,exp,pow,PI}=Math; return (${cleaned});`,
    ) as (x: number) => number;
  } catch {
    return [];
  }
  const pts: { x: number; y: number }[] = [];
  for (let x = xMin; x <= xMax + 1e-9; x += step) {
    let y: number;
    try { y = Number(fn(x)); } catch { continue; }
    if (!Number.isFinite(y)) continue;
    pts.push({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) });
  }
  return pts;
}

function graphNode(p: Record<string, string>): TipTapNode {
  const xMin = num(p.xMin, -5);
  const xMax = num(p.xMax, 5);
  const step = Math.max(0.1, num(p.step, Math.max(0.25, (xMax - xMin) / 40)));
  let points: { x: number; y: number; label?: string }[] = [];
  if (p.points) {
    points = p.points
      .split(";")
      .map((pair) => pair.split(",").map((n) => Number(n.trim())))
      .filter((a) => a.length >= 2 && a.every((n) => Number.isFinite(n)))
      .map(([x, y]) => ({ x, y }));
  } else if (p.equation) {
    points = sampleEquation(p.equation, xMin, xMax, step);
  }
  const squaresX = Math.max(10, Math.ceil(xMax - xMin) + 4);
  return {
    type: "smartGraph",
    attrs: {
      ...DEFAULT_GRAPH,
      xLabel: p.xLabel || DEFAULT_GRAPH.xLabel,
      yLabel: p.yLabel || DEFAULT_GRAPH.yLabel,
      squaresX,
      originSquareX: Math.max(0, Math.round(-xMin) + 2),
      connect: (p.connect as any) || (p.equation ? "smooth" : "straight"),
      points,
    },
  };
}

/* -------------------------- Asset / 2D diagram --------------------------- */

function assetNode(query: string, extra?: Record<string, unknown>): TipTapNode | null {
  const a = resolveAsset(query);
  if (!a) return null;
  const r = a.render;
  if (r.kind === "symbol") {
    return { type: "paragraph", content: [{ type: "text", text: r.char }] };
  }
  if (r.kind === "visual") {
    return {
      type: "paragraph",
      content: [
        {
          type: "mathVisual",
          attrs: { family: r.visual, attrs: { ...(r.attrs ?? {}), ...(extra ?? {}) } },
        },
      ],
    };
  }
  if (r.kind === "structure") {
    return structureNode({ kind: r.structure }, r.attrs);
  }
  if (r.kind === "variants" && r.children.length) {
    return assetNode(r.children[0].id, extra);
  }
  return null;
}

/* ------------------------------ Structures ------------------------------- */

function structureNode(
  p: Record<string, string>,
  attrs?: Record<string, unknown>,
): TipTapNode | null {
  const kind = p.kind;
  if (!kind) return null;
  const values = splitList(p.slots);
  const needed = Math.max(1, requiredSlotCount(kind, attrs) || values.length || 2);
  const slots = Array.from({ length: needed }, (_, i) => ({
    type: "mathSlot",
    content: values[i] ? [{ type: "text", text: values[i] }] : [],
  }));
  let content: any = { type: "mathStructure", attrs: { kind, attrs: attrs ?? {} }, content: slots };
  const check = validateStructure(content);
  if ((check as any).ok === false) content = (check as any).fix;
  return { type: "paragraph", content: [content] };
}

/* ------------------------------- 3D solids ------------------------------- */

function solid3dNode(p: Record<string, string>): TipTapNode | null {
  const kind = p.kind as Solid3DKind;
  if (!kind || !(kind in SOLID_DEFS)) return null;
  const solid = createSolid(kind, EMPTY_SCENE_3D.settings.defaultDisplay);
  const params = { ...(solid.params ?? {}) };
  for (const [k, v] of Object.entries(p)) {
    if (k === "kind") continue;
    if (k in params && Number.isFinite(Number(v))) params[k] = Number(v);
  }
  if (p.diameter && Number.isFinite(Number(p.diameter)) && "radius" in params) {
    params.radius = Number(p.diameter) / 2;
  }
  return {
    type: "scene3dDiagram",
    attrs: {
      scene: { ...EMPTY_SCENE_3D, objects: [{ ...solid, params }] },
      height: 360,
    },
  };
}

/* ------------------------------ Calculator ------------------------------- */

function calcNode(p: Record<string, string>): TipTapNode {
  return {
    type: "smartCalc",
    attrs: {
      expression: p.expression ?? "",
      formula: p.formula ?? "",
      substitution: p.substitution ?? "",
      steps: splitList(p.steps, ";"),
      answer: p.answer ?? "",
    },
  };
}

/* --------------------------------- API ----------------------------------- */

/** Convert one directive into a TipTap node, or null when unresolvable. */
export function materializeDirective(d: Directive): TipTapNode | null {
  try {
    switch (d.tool) {
      case "smartTable":
      case "table":
        return smartTableNode(d.params);
      case "graph":
      case "smartGraph":
        return graphNode(d.params);
      case "diagram":
        return assetNode(d.params.asset || d.params.query || d.params.kind || "", {
          label: d.params.label,
        });
      case "asset":
        return assetNode(d.params.query || d.params.id || "");
      case "structure":
        return structureNode(d.params);
      case "solid3d":
      case "object3d":
        return solid3dNode(d.params);
      case "calc":
      case "calculator":
        return calcNode(d.params);
      default:
        // Unknown tool id — try the Asset Library before giving up.
        return assetNode(d.params.query || d.params.asset || d.tool);
    }
  } catch {
    return null;
  }
}

/** Split raw AI text into plain-text chunks and resolved directive nodes. */
export function splitDirectives(
  text: string,
): Array<{ kind: "text"; text: string } | { kind: "node"; node: TipTapNode }> {
  const out: Array<{ kind: "text"; text: string } | { kind: "node"; node: TipTapNode }> = [];
  let last = 0;
  const re = new RegExp(DIRECTIVE_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    const node = materializeDirective(parseDirective(m[1], m[2] ?? "", m[0]));
    if (node) out.push({ kind: "node", node });
    else {
      // Fallback: keep whatever readable params the model supplied as text.
      const params = parseParams(m[2] ?? "");
      const readable = Object.values(params).join(" ").trim();
      if (readable) out.push({ kind: "text", text: readable });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

export const hasDirectives = (text: string) =>
  new RegExp(DIRECTIVE_RE.source).test(text || "");
