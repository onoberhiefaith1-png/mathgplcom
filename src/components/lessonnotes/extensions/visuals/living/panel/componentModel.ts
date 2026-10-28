// Universal component model for the Smart Geometry Editor.
//
// Every visible mark in a diagram is a Component. Components live inside
// `attrs.components` on the tiptap mathVisual node so they persist with
// the document. Selecting a component in the PropertyPanel swaps the panel
// contents to that component's section stack.

import type { Nodes, Point } from "../geometry";

export type ComponentKind =
  | "line" | "vertex" | "angle" | "arc" | "fill"
  | "label" | "measurement" | "tick" | "parallelMark" | "rightAngle"
  | "arrow" | "region" | "face" | "edge"
  | "chord" | "radius" | "diameter" | "circle"
  | "bar" | "cell" | "axis" | "marker";

export interface Component {
  id: string;
  kind: ComponentKind;
  parentId?: string;
  /** IDs of referenced components (e.g. angle → 3 vertex ids). */
  refs?: Record<string, string>;
  /** Node names in the geometric adapter (e.g. `nodes: ["A","B"]` for line AB). */
  nodes?: string[];
  geometry?: { position?: Point; size?: number; rotation?: number };
  appearance?: {
    color?: string;
    fill?: string;
    opacity?: number;
    dash?: "solid" | "dashed" | "dotted";
    thickness?: number;
  };
  behaviour?: { visible?: boolean; locked?: boolean; snap?: boolean };
  content?: {
    label?: string;
    value?: number | string;
    unit?: string;
    labelOffset?: Point;
    labelPosition?: "above" | "below" | "left" | "right" | "inside" | "outside" | "free";
    /** Show measured length on the diagram (line components). Default true. */
    showLength?: boolean;
    /** Show text label on the diagram. Default true. */
    showLabel?: boolean;
    /** Optional per-label style overrides. Everything defaults to Auto. */
    labelStyle?: {
      /** Font size in CSS pixels. Undefined = auto. */
      sizePx?: number;
      /** "normal" | "bold". Undefined = auto (normal). */
      weight?: "normal" | "bold";
      /** Colour token. Undefined = auto (currentColor). */
      color?: string;
      /** Manual placement direction. Undefined = auto. */
      position?: "above" | "below" | "left" | "right" | "inside" | "outside";
      /** Extra offset from geometry in CSS pixels. Undefined = auto. */
      offsetPx?: number;
    };
  };

}

export function newComponentId(prefix = "c"): string {
  return `${prefix}${Math.random().toString(36).slice(2, 9)}`;
}

export function displayName(c: Component): string {
  if (c.content?.label) return String(c.content.label);
  if (c.kind === "line" && c.nodes?.length === 2) return `Line ${c.nodes.join("")}`;
  if (c.kind === "vertex" && c.nodes?.length === 1) return `Point ${c.nodes[0]}`;
  if (c.kind === "angle" && c.nodes?.length === 3) return `∠${c.nodes.join("")}`;
  return `${c.kind[0].toUpperCase()}${c.kind.slice(1)}`;
}

/** Return midpoint / centre for a component in SVG coordinates. */
export function componentAnchor(c: Component, nodes: Nodes | null): Point | null {
  if (!nodes) return c.geometry?.position ?? null;
  if (c.kind === "vertex" && c.nodes?.[0]) return nodes[c.nodes[0]] ?? null;
  if (c.kind === "line" && c.nodes?.length === 2) {
    const a = nodes[c.nodes[0]]; const b = nodes[c.nodes[1]];
    if (!a || !b) return null;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  if (c.kind === "angle" && c.nodes?.length === 3) {
    return nodes[c.nodes[1]] ?? null;
  }
  return c.geometry?.position ?? null;
}

// ── decomposers ─────────────────────────────────────────────────────────
// Given (variant, nodes), emit the initial component list. Runs once when
// a diagram is inserted; subsequent edits mutate the array.

type EdgeSpec = [string, string];

function polygonEdges(names: string[]): EdgeSpec[] {
  return names.map((n, i) => [n, names[(i + 1) % names.length]] as EdgeSpec);
}

function polygonAngles(names: string[]): [string, string, string][] {
  const n = names.length;
  return names.map((v, i) => [names[(i - 1 + n) % n], v, names[(i + 1) % n]]);
}

function build(names: string[], edges: EdgeSpec[], angles: [string, string, string][]): Component[] {
  const out: Component[] = [];
  // Fill (only for closed polygons with 3+ vertices)
  if (edges.length >= 3) {
    out.push({
      id: newComponentId("fill"), kind: "fill",
      appearance: { fill: "transparent", opacity: 1 },
      behaviour: { visible: true, locked: false },
    });
  }
  for (const [a, b] of edges) {
    out.push({
      id: newComponentId("ln"), kind: "line", nodes: [a, b],
      appearance: { color: "currentColor", thickness: 2, dash: "solid" },
      behaviour: { visible: true, locked: false },
    });
  }
  for (const [a, v, c] of angles) {
    out.push({
      id: newComponentId("ang"), kind: "angle", nodes: [a, v, c],
      appearance: { color: "currentColor", thickness: 1.3 },
      behaviour: { visible: true, locked: false },
      content: { labelPosition: "inside" },
    });
  }
  for (const n of names) {
    out.push({
      id: newComponentId("v"), kind: "vertex", nodes: [n],
      appearance: { color: "currentColor" },
      behaviour: { visible: true, locked: false },
      content: { label: n },
    });
  }
  return out;
}

/** Decompose a diagram into components. Returns [] when unknown. */
export function decompose(variant: string, nodes: Nodes | null): Component[] {
  if (!nodes) return [];
  const names = Object.keys(nodes);

  // Triangles
  if (["triangle", "triangleScalene", "triangleIso", "triangleEqui",
       "triangleRight", "rightTriangle", "acuteTriangle", "obtuseTriangle",
      ].includes(variant) && names.length === 3) {
    return build(names, polygonEdges(names), polygonAngles(names));
  }

  // Quads / regular polygons — any adapter whose nodes form a cycle
  if (names.length >= 3 && names.length <= 12 &&
      !["circle", "semicircle", "quadrant", "sphere"].includes(variant)) {
    // Assume names in insertion order form the polygon cycle.
    return build(names, polygonEdges(names), polygonAngles(names));
  }

  // Simple line segment
  if (names.length === 2) {
    const [a, b] = names;
    return [
      { id: newComponentId("ln"), kind: "line", nodes: [a, b],
        appearance: { color: "currentColor", thickness: 2, dash: "solid" },
        behaviour: { visible: true, locked: false } },
      { id: newComponentId("v"), kind: "vertex", nodes: [a],
        behaviour: { visible: true, locked: false }, content: { label: a } },
      { id: newComponentId("v"), kind: "vertex", nodes: [b],
        behaviour: { visible: true, locked: false }, content: { label: b } },
    ];
  }

  // Angle (V, A, B)
  if (names.length === 3 && names.includes("V")) {
    const [V, A, B] = ["V", names.find(n => n !== "V")!, names.find((n, i) => n !== "V" && i > 0)!];
    return [
      { id: newComponentId("ln"), kind: "line", nodes: [V, A],
        appearance: { color: "currentColor", thickness: 2 },
        behaviour: { visible: true, locked: false } },
      { id: newComponentId("ln"), kind: "line", nodes: [V, B],
        appearance: { color: "currentColor", thickness: 2 },
        behaviour: { visible: true, locked: false } },
      { id: newComponentId("ang"), kind: "angle", nodes: [A, V, B],
        appearance: { color: "currentColor", thickness: 1.3 },
        behaviour: { visible: true, locked: false }, content: { labelPosition: "inside" } },
      ...names.map(n => ({
        id: newComponentId("v"), kind: "vertex" as ComponentKind, nodes: [n],
        behaviour: { visible: true, locked: false }, content: { label: n },
      })),
    ];
  }

  return [];
}

// ── patch helpers ───────────────────────────────────────────────────────
export function patchComponent(
  components: Component[], id: string, patch: Partial<Component>,
): Component[] {
  return components.map(c => c.id === id ? deepMerge(c, patch) : c);
}

export function removeComponent(components: Component[], id: string): Component[] {
  return components.filter(c => c.id !== id);
}

function deepMerge<T>(a: T, b: Partial<T>): T {
  const out: any = { ...a };
  for (const k of Object.keys(b) as (keyof T)[]) {
    const av = (a as any)[k]; const bv = (b as any)[k];
    if (av && bv && typeof av === "object" && typeof bv === "object" && !Array.isArray(av)) {
      out[k] = { ...av, ...bv };
    } else {
      out[k] = bv;
    }
  }
  return out;
}
