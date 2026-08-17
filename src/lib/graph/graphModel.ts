// Smart Graph data model — shared by the Lesson Notes TipTap node and the
// Smartboard's board-owned graph objects, so both run the same engine.

import { DEFAULT_GRAPH_THEME, themeFromLegacy } from "@/lib/graph/graphTheme";
import type { GraphThemeId } from "@/lib/graph/graphTheme";

export type ConnectStyle = "straight" | "smooth" | "broken" | "scatter";

export interface GraphPoint { x: number; y: number; label?: string }

/** A geometry shape drawn on top of the graph, in DATA coordinates. */
export interface GraphShape {
  id: string;
  kind: "point" | "line" | "circle" | "arc" | "polygon";
  pts: Array<{ x: number; y: number }>;
  label?: string;
}

/** A free overlay object placed on the graph paper, in DATA coordinates. */
export interface GraphOverlay {
  id: string;
  kind: "text" | "formula" | "triangle" | "circle" | "rectangle" | "angle" | "image";
  x: number;
  y: number;
  w?: number;
  h?: number;
  payload?: Record<string, unknown>;
}

/** A plotted mathematical function, always y = expression. */
export interface GraphFunction {
  id: string;
  expression: string;
  colour: string;
  thickness: number;
  dash: "solid" | "dashed" | "dotted";
  hidden?: boolean;
  domainMin?: number | null;
  domainMax?: number | null;
}

/**
 * Presentation-only styling. Never affects the mathematics.
 *
 * Two colours only: the theme supplies a background and a single ink colour.
 * Axes, numbers, labels and both grid levels are that same ink at different
 * opacities — see src/lib/graph/graphTheme.ts.
 */
export interface GraphStyle {
  theme: GraphThemeId;
  /** Axis line weight in px. */
  axisWidth: number;
  /** Minor grid divisions per centimetre square. */
  minorPerMajor: number;
  /** Major grid opacity (fraction of the ink colour). */
  majorAlpha: number;
  /** Minor grid opacity (fraction of the ink colour). */
  minorAlpha: number;
  pointShape: "dot" | "cross" | "circle";
  pointSize: number;
  plotWidth: number;
}

export const DEFAULT_GRAPH_STYLE: GraphStyle = {
  theme: DEFAULT_GRAPH_THEME,
  axisWidth: 2,
  minorPerMajor: 5,
  majorAlpha: 0.25,
  minorAlpha: 0.1,
  pointShape: "dot",
  pointSize: 3.5,
  plotWidth: 1.75,
};

export interface SmartGraphAttrs {
  unitsPerSquareX: number;
  unitsPerSquareY: number;
  squaresX: number;
  squaresY: number;
  originSquareX: number;
  originSquareY: number;
  xLabel: string;
  yLabel: string;
  points: GraphPoint[];
  connect: ConnectStyle;
  shapes: GraphShape[];
  overlays: GraphOverlay[];
  functions: GraphFunction[];
  style: GraphStyle;
  /** View-only zoom. The mathematics is untouched by it. */
  viewZoom: number;
  /** Independent object geometry on the lesson-note canvas (px). */
  frameW: number;
  frameH: number;
  offsetX: number;
  offsetY: number;
}

export const DEFAULT_GRAPH: SmartGraphAttrs = {
  unitsPerSquareX: 1,
  unitsPerSquareY: 1,
  // Landscape by default — X gets substantially more space than Y.
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
  frameW: 980,
  frameH: 480,
  offsetX: 0,
  offsetY: 0,
};

const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** Defensive normaliser so older saved graphs and board copies always load. */
export function sanitizeGraphAttrs(raw: unknown): SmartGraphAttrs {
  const r = (raw ?? {}) as Partial<SmartGraphAttrs>;
  return {
    unitsPerSquareX: Math.abs(num(r.unitsPerSquareX, 1)) || 1,
    unitsPerSquareY: Math.abs(num(r.unitsPerSquareY, 1)) || 1,
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
    style: normalizeStyle(r.style),
    viewZoom: Math.max(0.25, Math.min(4, num(r.viewZoom, 1))),
    frameW: Math.max(240, num(r.frameW, DEFAULT_GRAPH.frameW)),
    frameH: Math.max(180, num(r.frameH, DEFAULT_GRAPH.frameH)),
    offsetX: num(r.offsetX, 0),
    offsetY: num(r.offsetY, 0),
  };
}

/** Accepts both the current theme style and the old per-part colour style. */
function normalizeStyle(raw: unknown): GraphStyle {
  const r = (raw ?? {}) as Partial<GraphStyle> & { background?: string };
  const theme = r.theme ?? themeFromLegacy(raw);
  return {
    theme,
    axisWidth: Math.max(1, num(r.axisWidth, DEFAULT_GRAPH_STYLE.axisWidth)),
    minorPerMajor: Math.max(1, Math.round(num(r.minorPerMajor, 5))),
    majorAlpha: num(r.majorAlpha, DEFAULT_GRAPH_STYLE.majorAlpha),
    minorAlpha: num(r.minorAlpha, DEFAULT_GRAPH_STYLE.minorAlpha),
    pointShape: r.pointShape ?? "dot",
    pointSize: Math.max(1, num(r.pointSize, 3.5)),
    plotWidth: Math.max(0.5, num(r.plotWidth, 1.75)),
  };
}
