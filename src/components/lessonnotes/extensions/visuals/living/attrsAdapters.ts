// Attribute-based adapters for diagram families that don't have vertex
// geometry (grid, numberline, chart, plot, table, manip, tool, illus, and
// shape variants without a full geometric adapter). They expose editable
// properties through the same Adjust panel by reading/writing the tiptap
// node's `attrs` bag directly. No nodes, no handles — just data + a
// live-updating static SVG rendered via visualDispatch.

import type { Field, ComponentDef } from "./schema";

export type AttrsAdapter = {
  /** Rows shown in the Adjust panel. */
  schema: (attrs: Record<string, unknown>) => Field[];
  /** Reshape by writing a single named property; returns the patched attrs. */
  setAttrs: (name: string, raw: string, attrs: Record<string, unknown>)
    => Record<string, unknown> | { error: string };
  /** Optional lightweight Add Component menu. */
  componentMenu?: () => ComponentDef[];
  /** Hide sections that don't apply. */
  hideRotate?: boolean;
  hideAddComponent?: boolean;
};

// ── helpers ─────────────────────────────────────────────────────────────
const asStr = (v: unknown, fb = ""): string => (v == null ? fb : String(v));
const asNum = (v: unknown, fb: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const parseNum = (raw: string): number | null => {
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

// ── Number line ────────────────────────────────────────────────────────
const numberlineAdapter: AttrsAdapter = {
  hideRotate: true,
  schema: (a) => [
    { kind: "number", name: "min",  label: "Minimum",  value: asNum(a.min, 0) },
    { kind: "number", name: "max",  label: "Maximum",  value: asNum(a.max, 10) },
    { kind: "number", name: "step", label: "Tick step", value: asNum(a.step, 1), min: 0.01 },
    { kind: "number", name: "marker", label: "Marker", value: asNum(a.marker, 5) },
    { kind: "select", name: "mode",  label: "Marker style", value: asStr(a.mode, "none"),
      options: [
        { value: "none",   label: "No marker" },
        { value: "open",   label: "Open circle" },
        { value: "closed", label: "Closed circle" },
      ] },
  ],
  setAttrs: (name, raw, a) => {
    if (name === "mode") return { ...a, mode: raw };
    const v = parseNum(raw);
    if (v === null) return { error: "Not a number." };
    if (name === "step" && v <= 0) return { error: "Step must be > 0." };
    if (name === "max" && v <= asNum(a.min, 0)) return { error: "Max must exceed min." };
    if (name === "min" && v >= asNum(a.max, 10)) return { error: "Min must be less than max." };
    return { ...a, [name]: v };
  },
  componentMenu: () => [
    { kind: "addMarker", label: "Point marker", group: "Data", disabled: true },
  ],
};

// ── Grid ────────────────────────────────────────────────────────────────
const gridAdapter: AttrsAdapter = {
  hideRotate: true,
  hideAddComponent: true,
  schema: (a) => [
    { kind: "select", name: "variant", label: "Grid type", value: asStr(a.variant, "grid4"),
      options: [
        { value: "grid4",         label: "Four quadrants" },
        { value: "grid1",         label: "First quadrant" },
        { value: "gridBlank",     label: "Axes only" },
        { value: "polar",         label: "Polar" },
        { value: "isometricDots", label: "Isometric dots" },
      ] },
  ],
  setAttrs: (name, raw, a) => ({ ...a, [name]: raw }),
};

// ── Chart ───────────────────────────────────────────────────────────────
const chartAdapter: AttrsAdapter = {
  hideRotate: true,
  schema: (a) => [
    { kind: "select", name: "variant", label: "Chart type", value: asStr(a.variant, "barchart"),
      options: [
        { value: "barchart",  label: "Bar chart" },
        { value: "histogram", label: "Histogram" },
        { value: "linegraph", label: "Line graph" },
        { value: "scatter",   label: "Scatter plot" },
        { value: "dotplot",   label: "Dot plot" },
        { value: "piechart",  label: "Pie chart" },
        { value: "boxplot",   label: "Box plot" },
        { value: "ogive",     label: "Ogive" },
      ] },
    { kind: "text", name: "data", label: "Data (comma-separated)",
      value: asStr(a.data, ""),
      placeholder: "e.g. 3, 5, 2, 8, 4" },
    { kind: "text", name: "xLabel", label: "X axis label", value: asStr(a.xLabel, "") },
    { kind: "text", name: "yLabel", label: "Y axis label", value: asStr(a.yLabel, "") },
  ],
  setAttrs: (name, raw, a) => ({ ...a, [name]: raw }),
  componentMenu: () => [
    { kind: "addBar",    label: "Data bar",    group: "Data", disabled: true },
    { kind: "addSeries", label: "Second series", group: "Data", disabled: true },
  ],
};

// ── Plot ────────────────────────────────────────────────────────────────
const plotAdapter: AttrsAdapter = {
  hideRotate: true,
  hideAddComponent: true,
  schema: (a) => [
    { kind: "select", name: "variant", label: "Function", value: asStr(a.variant, "sinegraph"),
      options: [
        { value: "sinegraph",    label: "sin(x)" },
        { value: "cosinegraph",  label: "cos(x)" },
        { value: "tangentgraph", label: "tan(x)" },
        { value: "parabola",     label: "Parabola" },
        { value: "cubic",        label: "Cubic" },
        { value: "exponential",  label: "Exponential" },
        { value: "bellcurve",    label: "Bell curve" },
        { value: "distanceTime", label: "Distance–time" },
        { value: "velocityTime", label: "Velocity–time" },
      ] },
    { kind: "number", name: "coeff", label: "Amplitude / a", value: asNum(a.coeff, 1), step: 0.1 },
    { kind: "number", name: "domainMin", label: "x min", value: asNum(a.domainMin, -4) },
    { kind: "number", name: "domainMax", label: "x max", value: asNum(a.domainMax, 4) },
  ],
  setAttrs: (name, raw, a) => {
    if (name === "variant") return { ...a, variant: raw };
    const v = parseNum(raw);
    if (v === null) return { error: "Not a number." };
    return { ...a, [name]: v };
  },
};

// ── Table ───────────────────────────────────────────────────────────────
const tableAdapter: AttrsAdapter = {
  hideRotate: true,
  schema: (a) => [
    { kind: "number", name: "rows", label: "Rows",    value: asNum(a.rows, 3), min: 1, max: 20, step: 1 },
    { kind: "number", name: "cols", label: "Columns", value: asNum(a.cols, 3), min: 1, max: 12, step: 1 },
    { kind: "select", name: "kind", label: "Cell pattern", value: asStr(a.kind, "blank"),
      options: [
        { value: "blank",     label: "Blank" },
        { value: "mul",       label: "Multiplication" },
        { value: "add",       label: "Addition" },
        { value: "tally",     label: "Tally" },
        { value: "stemleaf",  label: "Stem-and-leaf" },
      ] },
    { kind: "text", name: "headers", label: "Headers (comma-separated)",
      value: Array.isArray(a.headers) ? (a.headers as string[]).join(", ") : asStr(a.headers, "") },
  ],
  setAttrs: (name, raw, a) => {
    if (name === "kind") return { ...a, kind: raw };
    if (name === "headers") {
      const headers = raw.split(",").map(s => s.trim()).filter(Boolean);
      return { ...a, headers };
    }
    const v = parseNum(raw);
    if (v === null) return { error: "Not a number." };
    if (v < 1) return { error: "Must be at least 1." };
    return { ...a, [name]: Math.max(1, Math.round(v)) };
  },
  componentMenu: () => [
    { kind: "addRow",    label: "Row (use Rows field above)",    group: "Data", disabled: true },
    { kind: "addColumn", label: "Column (use Columns field above)", group: "Data", disabled: true },
  ],
};

// ── Generic (solids, nets, logic, tools, manip, illus, extra shapes) ────
// Nothing size-editable per attribute, but users still get the frame,
// Rotate (no-op for these visuals? — hidden), and Expand.
const genericAdapter: AttrsAdapter = {
  hideRotate: true,
  hideAddComponent: true,
  schema: () => [],
  setAttrs: (_name, _raw, a) => a,
};

// ── registry ────────────────────────────────────────────────────────────
const BY_FAMILY: Record<string, AttrsAdapter> = {
  numberline: numberlineAdapter,
  grid:       gridAdapter,
  chart:      chartAdapter,
  plot:       plotAdapter,
  table:      tableAdapter,
};

export function getAttrsAdapter(family: string): AttrsAdapter {
  return BY_FAMILY[family] ?? genericAdapter;
}
