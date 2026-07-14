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

  // Data Charts
  V("barchart", "Bar chart", "chart", "Data Charts", ["bar", "data"]),
  V("piechart", "Pie chart", "chart", "Data Charts", ["pie", "data"]),
  V("histogram", "Histogram", "chart", "Data Charts", ["hist", "data"]),
  V("scatter", "Scatter plot", "chart", "Data Charts", ["data"]),
  V("boxplot", "Box and whisker", "chart", "Data Charts", ["box", "data"]),
  V("linegraph", "Line graph", "chart", "Data Charts", ["line", "time series"]),
  V("dotplot", "Dot plot", "chart", "Data Charts", ["dot"]),
  V("ogive", "Cumulative frequency (ogive)", "chart", "Data Charts", ["cumulative"]),

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
