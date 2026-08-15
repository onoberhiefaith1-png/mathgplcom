// TipTap node holding a Smart Graph workspace.
//
// All state — scale, axis labels, data points, connection style — lives
// in the node attrs so undo/redo and persistence flow through TipTap.

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { SmartGraphView } from "@/components/lessonnotes/math-tools/SmartGraphView";

export type ConnectStyle = "straight" | "smooth" | "broken" | "scatter";

export interface GraphPoint { x: number; y: number; label?: string }

/** A geometry shape drawn on top of the graph. Points are in DATA coordinates
 *  so shapes stay anchored when the graph is expanded from any side. Older
 *  saved shapes may still be in pixel-space and are migrated on load. */
export interface GraphShape {
  id: string;
  kind: "point" | "line" | "circle" | "arc" | "polygon";
  pts: Array<{ x: number; y: number }>;
  label?: string;
}

/** A free overlay object placed on the graph paper (text, formula, shape,
 *  image, etc.). Position is in DATA coordinates so expand never shifts it. */
export interface GraphOverlay {
  id: string;
  kind: "text" | "formula" | "triangle" | "circle" | "rectangle" | "angle" | "image";
  x: number;
  y: number;
  w?: number; // width in data units (for sized objects)
  h?: number; // height in data units
  payload?: Record<string, unknown>;
}

/** A plotted mathematical function, y = expression. */
export interface GraphFunction {
  id: string;
  /** Right-hand side only — the tool always plots y = expression. */
  expression: string;
  colour: string;
  thickness: number;
  dash: "solid" | "dashed" | "dotted";
  hidden?: boolean;
  /** Optional domain restriction. Null / undefined = whole visible space. */
  domainMin?: number | null;
  domainMax?: number | null;
}

/** Presentation-only styling. Never affects the mathematics. */
export interface GraphStyle {
  background: string;
  axis: string;
  axisWidth: number;
  numbers: string;
  majorGrid: string;
  minorGrid: string;
  /** Minor grid divisions per centimetre square. */
  minorPerMajor: number;
  pointColour: string;
  pointShape: "dot" | "cross" | "circle";
  pointSize: number;
  plotColour: string;
  plotWidth: number;
}

export const DEFAULT_GRAPH_STYLE: GraphStyle = {
  background: "#ffffff",
  axis: "hsl(0 0% 10%)",
  axisWidth: 2,
  numbers: "hsl(0 0% 35%)",
  majorGrid: "hsl(0 0% 78%)",
  minorGrid: "hsl(0 0% 92%)",
  minorPerMajor: 5,
  pointColour: "hsl(220 90% 50%)",
  pointShape: "dot",
  pointSize: 3.5,
  plotColour: "hsl(220 90% 50%)",
  plotWidth: 1.75,
};

export interface SmartGraphAttrs {
  unitsPerSquareX: number;
  unitsPerSquareY: number;
  squaresX: number;
  squaresY: number;
  originSquareX: number; // origin offset in squares from left
  originSquareY: number; // origin offset in squares from top
  xLabel: string;
  yLabel: string;
  points: GraphPoint[];
  connect: ConnectStyle;
  shapes: GraphShape[];
  overlays: GraphOverlay[];
  functions: GraphFunction[];
  style: GraphStyle;
  /** View-only zoom / pan. Mathematics is untouched by these. */
  viewZoom: number;
  viewPanX: number;
  viewPanY: number;
}

export const DEFAULT_GRAPH: SmartGraphAttrs = {
  unitsPerSquareX: 1,
  unitsPerSquareY: 1,
  // Landscape by default — the X axis gets substantially more space.
  squaresX: 40,
  squaresY: 16,
  originSquareX: 20,
  originSquareY: 8,
  xLabel: "x",
  yLabel: "y",
  points: [],
  connect: "straight",
  shapes: [],
  overlays: [],
  functions: [],
  style: DEFAULT_GRAPH_STYLE,
  viewZoom: 1,
  viewPanX: 0,
  viewPanY: 0,
};

export const SmartGraphNode = Node.create({
  name: "smartGraph",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      unitsPerSquareX: { default: DEFAULT_GRAPH.unitsPerSquareX },
      unitsPerSquareY: { default: DEFAULT_GRAPH.unitsPerSquareY },
      squaresX: { default: DEFAULT_GRAPH.squaresX },
      squaresY: { default: DEFAULT_GRAPH.squaresY },
      originSquareX: { default: DEFAULT_GRAPH.originSquareX },
      originSquareY: { default: DEFAULT_GRAPH.originSquareY },
      xLabel: { default: DEFAULT_GRAPH.xLabel },
      yLabel: { default: DEFAULT_GRAPH.yLabel },
      points: { default: DEFAULT_GRAPH.points },
      connect: { default: DEFAULT_GRAPH.connect },
      shapes: { default: DEFAULT_GRAPH.shapes },
      overlays: { default: DEFAULT_GRAPH.overlays },
      functions: { default: DEFAULT_GRAPH.functions },
      style: { default: DEFAULT_GRAPH.style },
      viewZoom: { default: DEFAULT_GRAPH.viewZoom },
      viewPanX: { default: DEFAULT_GRAPH.viewPanX },
      viewPanY: { default: DEFAULT_GRAPH.viewPanY },
    };
  },


  parseHTML() {
    return [{ tag: "div[data-smart-graph]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-smart-graph": "" }), ""];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SmartGraphView);
  },
});

const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** Defensive normaliser so older saved graphs (and board copies) always load. */
export function sanitizeGraphAttrs(raw: unknown): SmartGraphAttrs {
  const r = (raw ?? {}) as Partial<SmartGraphAttrs>;
  const style = { ...DEFAULT_GRAPH_STYLE, ...((r.style ?? {}) as Partial<GraphStyle>) };
  return {
    unitsPerSquareX: num(r.unitsPerSquareX, DEFAULT_GRAPH.unitsPerSquareX),
    unitsPerSquareY: num(r.unitsPerSquareY, DEFAULT_GRAPH.unitsPerSquareY),
    squaresX: Math.max(4, Math.round(num(r.squaresX, DEFAULT_GRAPH.squaresX))),
    squaresY: Math.max(4, Math.round(num(r.squaresY, DEFAULT_GRAPH.squaresY))),
    originSquareX: num(r.originSquareX, DEFAULT_GRAPH.originSquareX),
    originSquareY: num(r.originSquareY, DEFAULT_GRAPH.originSquareY),
    xLabel: typeof r.xLabel === "string" ? r.xLabel : "x",
    yLabel: typeof r.yLabel === "string" ? r.yLabel : "y",
    points: Array.isArray(r.points) ? r.points : [],
    connect: (r.connect ?? "straight") as ConnectStyle,
    shapes: Array.isArray(r.shapes) ? r.shapes : [],
    overlays: Array.isArray(r.overlays) ? r.overlays : [],
    functions: Array.isArray(r.functions) ? r.functions : [],
    style,
    viewZoom: Math.max(0.25, Math.min(4, num(r.viewZoom, 1))),
    viewPanX: num(r.viewPanX, 0),
    viewPanY: num(r.viewPanY, 0),
  };
}

