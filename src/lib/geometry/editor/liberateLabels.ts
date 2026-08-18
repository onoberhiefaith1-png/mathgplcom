// liberateLabels — makes every piece of text inside a diagram a first-class
// editable object.
//
// Historically a circle/arc could carry a baked-in `label` string (e.g.
// "r1=5cm"). That text was drawn by the renderer but had no hit-test, no
// offset and no properties, so the teacher could not select, drag, restyle
// or delete it — the diagram was "90% editable".
//
// This pass converts those baked-in strings into real floating `label`
// objects placed exactly where they were being drawn, so they inherit the
// existing text machinery (click to select, drag to move, panel to edit
// size/colour/rotation, delete). It is idempotent: once converted, the
// shape no longer carries a label.

import type { GeometryScene, GeoLabel, GeoObject } from "../scene";
import { pointById } from "../scene";
import { newId } from "./labels";

export function liberateShapeLabels(scene: GeometryScene): GeometryScene {
  const hasBaked = scene.objects.some(
    (o) => (o.type === "circle" || o.type === "arc" || o.type === "polygon") && !!(o as any).label,
  );
  if (!hasBaked) return scene;

  let objects: GeoObject[] = [...scene.objects];
  const added: GeoLabel[] = [];

  objects = objects.map((o) => {
    const text = (o as any).label as string | undefined;
    if (!text) return o;

    let x: number | null = null;
    let y: number | null = null;

    if (o.type === "circle" || o.type === "arc") {
      const c = pointById(scene, o.center);
      if (c) {
        // Matches the renderer's former anchor for a shape label.
        x = c.x + o.r + 4;
        y = c.y - o.r - 4;
      }
    } else if (o.type === "polygon") {
      const pts = o.points.map((id) => pointById(scene, id)).filter(Boolean) as { x: number; y: number }[];
      if (pts.length) {
        x = pts.reduce((a, p) => a + p.x, 0) / pts.length;
        y = pts.reduce((a, p) => a + p.y, 0) / pts.length;
      }
    }

    if (x === null || y === null) return o;

    const label: GeoLabel = {
      id: newId("t", { ...scene, objects: [...objects, ...added] }),
      type: "label",
      x,
      y,
      text,
      fontSize: 13,
    };
    added.push(label);

    const next = { ...(o as any) };
    delete next.label;
    return next as GeoObject;
  });

  return { ...scene, objects: [...objects, ...added] };
}
