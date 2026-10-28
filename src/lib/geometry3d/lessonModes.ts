// The catalogue of Lesson Modes.
//
// A Lesson Mode is a mathematical topic, not a software mode: choosing
// "Surface Area" surfaces only the tools a teacher needs for that lesson.

import type { LessonModeId } from "./scene3d";

export interface LessonModeDef {
  id: LessonModeId;
  label: string;
  purpose: string;
  ready: boolean;
  tools: string[];
}

export const LESSON_MODES: LessonModeDef[] = [
  {
    id: "facesEdgesVertices",
    label: "Faces, Edges & Vertices",
    purpose: "Introduce the structure of solid figures.",
    ready: true,
    tools: ["Select face", "Select edge", "Select vertex", "Highlight", "Label", "Count faces", "Count edges", "Count vertices", "Show / hide labels"],
  },
  {
    id: "properties",
    label: "Properties of Solids",
    purpose: "Read the mathematical properties of the selected solid.",
    ready: true,
    tools: ["Mathematical name", "Shape family", "Face / edge / vertex counts", "Flat and curved surfaces", "Euler's formula"],
  },
  {
    id: "measurements",
    label: "Measurements",
    purpose: "Teach the dimensions of solids.",
    ready: true,
    tools: ["Edge length", "Face area", "Curved circumference", "Radius / diameter", "Height", "Slant height", "Distance between two vertices"],
  },
  {
    id: "angles",
    label: "Angles & Geometry",
    purpose: "Teach angular relationships in three dimensions.",
    ready: true,
    tools: ["Angle between two edges", "Dihedral angle (two faces)", "Line-to-plane angle", "Right-angle marker"],
  },
  {
    id: "surfaceArea",
    label: "Surface Area",
    purpose: "Teach total and lateral surface area.",
    ready: true,
    tools: ["Shade face", "Multi-select", "Lateral / total totals", "Match opposite faces", "Curved surface formulas"],
  },
  {
    id: "volume",
    label: "Volume",
    purpose: "Emphasise the dimensions used by the volume formula.",
    ready: true,
    tools: ["Formula card", "Numeric substitution", "Result", "Dimension arrows", "Units & precision"],
  },
  {
    id: "nets",
    label: "Nets",
    purpose: "Teach the net of a solid.",
    ready: true,
    tools: ["Unfolded 2D net", "Face-matching colours", "Dimension labels"],
  },
  {
    id: "crossSections",
    label: "Cross Sections",
    purpose: "Teach plane sections of solids.",
    ready: true,
    tools: ["Horizontal / vertical plane", "Plane offset", "Section outline", "Section area"],
  },
  {
    id: "coordinates",
    label: "Coordinate Geometry (3D)",
    purpose: "Teach coordinates in three-dimensional space.",
    ready: true,
    tools: ["Show vertex coordinates", "Add point", "Join points", "Distance between points", "Projections onto planes"],
  },
  {
    id: "transformations",
    label: "Transformations",
    purpose: "Teach transformations of solids.",
    ready: true,
    tools: ["Rotate", "Reflect", "Translate", "Enlarge / Reduce", "Ghost preview & Apply"],
  },
];

export const LESSON_MODE_BY_ID: Record<LessonModeId, LessonModeDef> = Object.fromEntries(
  LESSON_MODES.map((m) => [m.id, m]),
) as Record<LessonModeId, LessonModeDef>;
