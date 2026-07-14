import type { AssetDef } from "./types";

const V = (
  id: string,
  label: string,
  visual: string,
  group: string,
  keywords: string[],
  attrs: Record<string, unknown> = {},
): AssetDef => ({
  id,
  label,
  category: "Graphs",
  group,
  keywords: [id, label.toLowerCase(), ...keywords],
  render: { kind: "visual", visual, attrs: { variant: id, ...attrs } },
});

export const GRAPHS: AssetDef[] = [
  // Coordinate Planes — one Smart Coordinate Plane that switches modes.
  {
    id: "coordPlane",
    label: "Coordinate plane",
    category: "Graphs",
    group: "Coordinate Planes",
    keywords: ["coordinate", "plane", "grid", "axes", "cartesian", "polar",
               "complex", "argand", "isometric", "dot", "graph"],
    render: {
      kind: "visual",
      visual: "coordPlane",
      attrs: {
        mode: "cartesian4",
        view: { xMin: -10, xMax: 10, yMin: -10, yMax: 10, gridStep: 1, equalScale: true },
      },
    },
    hint: "Smart",
  },


  // Number Lines
  V("numberline", "Number line (blank)", "numberline", "Number Lines", ["line"]),
  V("numberlineInt", "Number line (integers)", "numberline", "Number Lines", ["line"]),
  V("inequalityOpen", "Inequality (open circle)", "numberline", "Number Lines", ["line"]),
  V("inequalityClosed", "Inequality (closed circle)", "numberline", "Number Lines", ["line"]),

  // Data Charts — Smart Chart (interactive). Phase 1: Bar Chart is fully
  // interactive; the other kinds route to the same node with a
  // placeholder view and will be upgraded in follow-up phases.
  {
    id: "barchart", label: "Bar chart", category: "Graphs", group: "Data Charts",
    keywords: ["bar", "data", "chart"], hint: "Smart",
    render: { kind: "visual", visual: "smartChart", attrs: { kind: "bar" } },
  },
  {
    id: "piechart", label: "Pie chart", category: "Graphs", group: "Data Charts",
    keywords: ["pie", "data"], hint: "Smart",
    render: { kind: "visual", visual: "smartChart", attrs: { kind: "pie" } },
  },
  {
    id: "histogram", label: "Histogram", category: "Graphs", group: "Data Charts",
    keywords: ["hist", "data"], hint: "Smart",
    render: { kind: "visual", visual: "smartChart", attrs: { kind: "histogram" } },
  },
  {
    id: "scatter", label: "Scatter plot", category: "Graphs", group: "Data Charts",
    keywords: ["data", "scatter"], hint: "Smart",
    render: { kind: "visual", visual: "smartChart", attrs: { kind: "scatter" } },
  },
  {
    id: "boxplot", label: "Box and whisker", category: "Graphs", group: "Data Charts",
    keywords: ["box", "data"], hint: "Smart",
    render: { kind: "visual", visual: "smartChart", attrs: { kind: "boxplot" } },
  },
  {
    id: "linegraph", label: "Line graph", category: "Graphs", group: "Data Charts",
    keywords: ["line", "time series"], hint: "Smart",
    render: { kind: "visual", visual: "smartChart", attrs: { kind: "line" } },
  },
  {
    id: "dotplot", label: "Dot plot", category: "Graphs", group: "Data Charts",
    keywords: ["dot"], hint: "Smart",
    render: { kind: "visual", visual: "smartChart", attrs: { kind: "dotplot" } },
  },
  {
    id: "ogive", label: "Cumulative frequency (ogive)", category: "Graphs", group: "Data Charts",
    keywords: ["cumulative"], hint: "Smart",
    render: { kind: "visual", visual: "smartChart", attrs: { kind: "ogive" } },
  },

  // Function & Kinematics
  V("sinegraph", "Sine curve", "plot", "Function & Kinematics", ["trig"]),
  V("cosinegraph", "Cosine curve", "plot", "Function & Kinematics", ["trig"]),
  V("tangentgraph", "Tangent curve", "plot", "Function & Kinematics", ["trig"]),
  V("parabola", "Parabola", "plot", "Function & Kinematics", ["quadratic"]),
  V("cubic", "Cubic", "plot", "Function & Kinematics", []),
  V("exponential", "Exponential curve", "plot", "Function & Kinematics", ["exp"]),
  V("bellcurve", "Bell curve (normal)", "plot", "Function & Kinematics", ["normal", "distribution"]),
  V("distanceTime", "Distance–time graph", "plot", "Function & Kinematics", ["kinematics", "speed"]),
  V("velocityTime", "Velocity–time graph", "plot", "Function & Kinematics", ["kinematics"]),
];
