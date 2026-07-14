// Universal Logic & Organisation Engine.

export type OrgDirection = "TB" | "BT" | "LR" | "RL" | "radial" | "free";
export type OrgShape = "rect" | "roundedRect" | "circle" | "diamond" | "hexagon";
export type OrgEdgeStyle = "straight" | "curved";
export type OrgArrow = "none" | "single" | "double";
export type OrgDash = "solid" | "dashed";

export interface OrgEdgeStyleModel {
  style: OrgEdgeStyle;
  arrow: OrgArrow;
  dash: OrgDash;
  label: string;
}

export interface OrgNode {
  id: string;
  text: string;
  color: string;     // fill
  border: string;
  shape: OrgShape;
  collapsed: boolean;
  edge: OrgEdgeStyleModel; // style of the edge from parent to this node
  children: OrgNode[];
  // free-layout coords (used only when direction = "free")
  fx?: number;
  fy?: number;
}

export interface OrgModel {
  root: OrgNode;
  direction: OrgDirection;
}

export function newOrgId(): string {
  return `o${Math.random().toString(36).slice(2, 9)}`;
}

export const DEFAULT_EDGE = (): OrgEdgeStyleModel => ({
  style: "curved",
  arrow: "none",
  dash: "solid",
  label: "",
});
