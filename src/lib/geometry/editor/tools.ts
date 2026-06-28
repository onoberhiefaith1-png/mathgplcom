// Tool identifiers used by the Geometry Editor Panel.

export type ToolId =
  | "select"
  | "point"
  | "line"
  | "arc"
  | "circle"
  | "polygon"
  | "angle"
  | "label"
  | "measure"
  | "equalMark"
  | "parallel"
  | "perpendicular"
  | "rightAngle"
  | "midpoint"
  | "compass"
  | "move"
  | "erase"
  | "constraint"
  | "rotate"
  | "sketch";

export interface ToolDescriptor {
  id: ToolId;
  label: string;
  hint: string;
  shortcut?: string;
}

export const TOOLS: ToolDescriptor[] = [
  { id: "select", label: "Select", hint: "Click an object to select it", shortcut: "V" },
  { id: "point", label: "Point", hint: "Click to place a point", shortcut: "P" },
  { id: "line", label: "Line", hint: "Click points in sequence; Esc to finish", shortcut: "L" },
  { id: "arc", label: "Arc", hint: "Click start, mid, end", shortcut: "A" },
  { id: "circle", label: "Circle", hint: "Click center, then a radius point", shortcut: "C" },
  { id: "polygon", label: "Polygon", hint: "Click points; Enter to close", shortcut: "G" },
  { id: "angle", label: "Angle", hint: "Click arm1, vertex, arm2", shortcut: "N" },
  { id: "label", label: "Label", hint: "Click an object to label it", shortcut: "T" },
  { id: "measure", label: "Measure", hint: "Click a side or angle to add a value", shortcut: "M" },
  { id: "equalMark", label: "Equal mark", hint: "Click two sides (or two angles) to mark equal" },
  { id: "parallel", label: "Parallel", hint: "Click two segments to mark parallel" },
  { id: "perpendicular", label: "Perpendicular", hint: "Click two intersecting segments" },
  { id: "rightAngle", label: "Right angle", hint: "Click an angle to mark 90°" },
  { id: "midpoint", label: "Midpoint", hint: "Click a segment to add its midpoint" },
  { id: "compass", label: "Compass arc", hint: "Click center, then a radius point (dashed)" },
  { id: "move", label: "Move", hint: "Drag points to move; dependents follow" },
  { id: "erase", label: "Erase", hint: "Click an object to delete it" },
  { id: "constraint", label: "Constraint", hint: "Select objects, then choose a constraint" },
  { id: "rotate", label: "Rotate", hint: "Rotate the whole scene" },
  { id: "sketch", label: "Convert sketch", hint: "Sketch freely; AI reconstructs it" },
];
