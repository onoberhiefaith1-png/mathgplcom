// Tool identifiers used by the Geometry Editor Panel.

export type ToolId =
  | "select"
  | "point"
  | "line"
  | "arc"
  | "circle"
  | "curve"
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
  | "sketch"
  | "addText"
  | "addDistance"
  | "addAngle"
  | "addArea"
  // Structure-aware annotation tools driven from the right-hand
  // Diagram Tools panel (they attach to existing geometry).
  | "smartText"
  | "smartAngle"
  | "smartArea";

export type ToolGroup = "draw" | "shape" | "mark" | "measure" | "edit" | "ai" | "annotate";


export interface ToolDescriptor {
  id: ToolId;
  label: string;
  hint: string;
  group: ToolGroup;
  shortcut?: string;
}

export const TOOL_GROUPS: { id: ToolGroup; label: string }[] = [
  { id: "draw", label: "Draw" },
  { id: "shape", label: "Shapes" },
  { id: "mark", label: "Marks" },
  { id: "measure", label: "Measure" },
  { id: "edit", label: "Edit" },
  { id: "ai", label: "AI" },
];

export const TOOLS: ToolDescriptor[] = [
  { id: "select", label: "Select", hint: "Click an object to select it", group: "edit", shortcut: "V" },
  { id: "point", label: "Point", hint: "Click to place a point", group: "draw", shortcut: "P" },
  { id: "line", label: "Line", hint: "Click points in sequence; Esc to finish", group: "draw", shortcut: "L" },
  { id: "polygon", label: "Polygon", hint: "Click points; press Close (or Enter) to finish", group: "shape", shortcut: "G" },
  { id: "circle", label: "Circle", hint: "Click the centre, then a point on the circle (drag the rim point to resize)", group: "shape", shortcut: "C" },
  { id: "arc", label: "Arc", hint: "Click 3 points: start, through, end", group: "shape", shortcut: "A" },
  { id: "angle", label: "Angle", hint: "Click arm1, vertex, arm2", group: "mark", shortcut: "N" },
  { id: "rightAngle", label: "Right angle", hint: "Click an angle (or segment) to mark 90°", group: "mark" },
  { id: "equalMark", label: "Equal mark", hint: "Click two sides to mark them equal", group: "mark" },
  { id: "parallel", label: "Parallel", hint: "Click two segments to mark parallel", group: "mark" },
  { id: "perpendicular", label: "Perpendicular", hint: "Click two intersecting segments", group: "mark" },
  { id: "midpoint", label: "Midpoint", hint: "Click a segment to add its midpoint", group: "draw" },
  { id: "compass", label: "Compass arc", hint: "Click center, then a radius point (dashed)", group: "draw" },
  { id: "label", label: "Label", hint: "Click an object to label it", group: "measure", shortcut: "T" },
  { id: "measure", label: "Measure", hint: "Click a side or angle to add a value", group: "measure", shortcut: "M" },
  { id: "move", label: "Move", hint: "Drag points to move; dependents follow", group: "edit" },
  { id: "erase", label: "Erase", hint: "Click an object to delete it", group: "edit" },
  { id: "constraint", label: "Constraint", hint: "Select objects, then choose a constraint", group: "edit" },
  { id: "rotate", label: "Rotate", hint: "Rotate the whole scene 15°", group: "edit" },
  { id: "sketch", label: "Convert sketch", hint: "Sketch freely; AI reconstructs it", group: "ai" },
];
