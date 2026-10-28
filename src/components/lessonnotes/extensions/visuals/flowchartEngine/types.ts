// Universal Flowchart Engine model.

export type FlowShapeKind =
  | "process" | "decision" | "io" | "connector" | "start" | "end" | "comment";

export type FlowLayout = "horizontal" | "vertical" | "tree" | "radial" | "free";

export type EdgeStyle = "straight" | "orthogonal" | "curved";

export interface FlowNode {
  id: string;
  kind: FlowShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fill: string;
  border: string;
  radius: number;
  align: "left" | "center" | "right";
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  style: EdgeStyle;
  arrow: boolean;
  label: string;
  dash?: "solid" | "dashed";
}

export interface FlowModel {
  nodes: FlowNode[];
  edges: FlowEdge[];
  layout: FlowLayout;
  canvas: { w: number; h: number };
}

export function newId(prefix = "f"): string {
  return `${prefix}${Math.random().toString(36).slice(2, 9)}`;
}

export const SHAPE_DEFAULTS: Record<FlowShapeKind, Partial<FlowNode>> = {
  start:     { w: 120, h: 44, radius: 22, fill: "#dcfce7", border: "#16a34a", text: "Start" },
  end:       { w: 120, h: 44, radius: 22, fill: "#fee2e2", border: "#dc2626", text: "End" },
  process:   { w: 140, h: 50, radius: 4,  fill: "#e0f2fe", border: "#0369a1", text: "Process" },
  decision:  { w: 140, h: 80, radius: 0,  fill: "#fef3c7", border: "#b45309", text: "Decision?" },
  io:        { w: 140, h: 50, radius: 0,  fill: "#ede9fe", border: "#6d28d9", text: "Input / Output" },
  connector: { w: 40,  h: 40, radius: 20, fill: "#f3f4f6", border: "#6b7280", text: "•" },
  comment:   { w: 140, h: 50, radius: 4,  fill: "#fffbeb", border: "#d97706", text: "Comment" },
};

export function makeFlowNode(kind: FlowShapeKind, x: number, y: number): FlowNode {
  const d = SHAPE_DEFAULTS[kind];
  return {
    id: newId("n"),
    kind,
    x, y,
    w: d.w!,
    h: d.h!,
    text: d.text!,
    fill: d.fill!,
    border: d.border!,
    radius: d.radius!,
    align: "center",
  };
}
