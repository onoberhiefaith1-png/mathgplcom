// Diagram references.
//
// A question owns exactly ONE authoritative geometry diagram. The Solution
// never draws a new one — it REFERENCES the question's diagram by `diagramId`
// and, where useful, names the existing elements it talks about.

import type { Node as PMNode } from "@tiptap/pm/model";
import type { GeometryScene } from "@/lib/geometry/scene";

export interface DiagramRef {
  diagramId: string;
  /** Ids of EXISTING scene elements the solution refers to (never new ones). */
  elementIds: string[];
}

/** The live `geometryDiagram` node with this id, or null. */
export function findDiagramById(
  doc: PMNode,
  diagramId: string | null | undefined,
): { pos: number; node: PMNode } | null {
  if (!diagramId) return null;
  let found: { pos: number; node: PMNode } | null = null;
  doc.descendants((n, p) => {
    if (found) return false;
    if (n.type.name === "geometryDiagram" && n.attrs?.diagramId === diagramId) {
      found = { pos: p, node: n };
      return false;
    }
    return true;
  });
  return found;
}

const pointLabel = (scene: GeometryScene, id: string): string => {
  const p = scene.objects.find((o: any) => o.id === id) as any;
  return (p?.label || "").trim();
};

/**
 * A plain-language inventory of what the EXISTING diagram already contains.
 * Fed to the solution generator so it references those exact labels instead of
 * inventing a new figure (new centre, renamed points, different angles).
 */
export function describeExistingDiagram(scene: GeometryScene | null | undefined): string {
  if (!scene || !Array.isArray((scene as any).objects) || scene.objects.length === 0) return "";
  const points: string[] = [];
  const segments: string[] = [];
  const circles: string[] = [];
  const angles: string[] = [];
  for (const o of scene.objects as any[]) {
    switch (o?.type) {
      case "point":
        if (o.label) points.push(String(o.label));
        break;
      case "segment": {
        const a = pointLabel(scene, o.a);
        const b = pointLabel(scene, o.b);
        if (a && b) segments.push(`${a}${b}`);
        break;
      }
      case "circle": {
        const c = pointLabel(scene, o.center);
        circles.push(c ? `circle with centre ${c}` : "circle");
        break;
      }
      case "angle": {
        const a = pointLabel(scene, o.a);
        const v = pointLabel(scene, o.vertex);
        const b = pointLabel(scene, o.b);
        const name = a && v && b ? `∠${a}${v}${b}` : "";
        if (name) angles.push(o.value ? `${name} = ${o.value}` : name);
        break;
      }
      default:
        break;
    }
  }
  const parts: string[] = [];
  if (circles.length) parts.push(circles.join("; "));
  if (points.length) parts.push(`points ${points.join(", ")}`);
  if (segments.length) parts.push(`lines ${segments.join(", ")}`);
  if (angles.length) parts.push(`angles ${angles.join(", ")}`);
  if (!parts.length) return "";
  return (
    "EXISTING QUESTION DIAGRAM (already drawn — do NOT redraw, rename, move or " +
    "reinterpret it; refer only to these exact elements): " +
    parts.join(" | ") +
    "."
  );
}

/** Element ids in `scene` whose labels are named by the solution text. */
export function matchElementIds(scene: GeometryScene | null | undefined, text: string): string[] {
  if (!scene || !text) return [];
  const out: string[] = [];
  for (const o of scene.objects as any[]) {
    let name = "";
    if (o?.type === "point") name = (o.label || "").trim();
    else if (o?.type === "segment") {
      const a = pointLabel(scene, o.a);
      const b = pointLabel(scene, o.b);
      name = a && b ? `${a}${b}` : "";
    } else if (o?.type === "angle") {
      const a = pointLabel(scene, o.a);
      const v = pointLabel(scene, o.vertex);
      const b = pointLabel(scene, o.b);
      name = a && v && b ? `${a}${v}${b}` : "";
    }
    if (!name) continue;
    const re = new RegExp(`(?<![A-Za-z])${name}(?![A-Za-z])`);
    if (re.test(text)) out.push(o.id);
  }
  return out;
}
