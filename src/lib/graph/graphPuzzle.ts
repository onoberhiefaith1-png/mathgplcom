import { sanitizeScene, type GeoObject, type GeometryScene } from "@/lib/geometry/scene";
import { SQ_BASE, fitPoints, toPx, viewFromPaper } from "./digitalView";
import { DEFAULT_GRAPH, sanitizeGraphAttrs, type GraphPoint } from "./graphModel";

export function graphPuzzleFrame(raw: unknown) {
  const attrs = sanitizeGraphAttrs(raw);
  const width = attrs.squaresX * SQ_BASE * attrs.viewZoom;
  const height = attrs.squaresY * SQ_BASE * attrs.viewZoom;
  return { attrs, width, height, view: viewFromPaper(attrs, width, height) };
}

export function tableGraphSnapshot(points: GraphPoint[], xLabel: string, yLabel: string, connect: typeof DEFAULT_GRAPH.connect) {
  const frame = graphPuzzleFrame(DEFAULT_GRAPH);
  const view = fitPoints(points, frame.width, frame.height);
  return { ...DEFAULT_GRAPH, points, xLabel, yLabel, connect,
    viewCx: view.cx, viewCy: view.cy, viewScaleX: view.scaleX, viewScaleY: view.scaleY };
}

export function readPuzzleScene(nodeType: string, raw: Record<string, unknown>): GeometryScene | null {
  if (nodeType !== "smartGraph") return sanitizeScene(raw.scene);
  const { attrs, width, height, view } = graphPuzzleFrame(raw);
  const objects: GeoObject[] = [];
  for (const shape of attrs.shapes) {
    if (!shape || typeof shape.id !== "string" || !Array.isArray(shape.pts) ||
      !shape.pts.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))) continue;
    const minimum = { point: 1, line: 2, circle: 2, arc: 3, polygon: 3 }[shape.kind];
    if (!minimum || shape.pts.length < minimum) continue;
    const id = `graph-shape:${shape.id}`;
    const points = shape.pts.map((point) => toPx(point, view, width, height));
    if (shape.kind === "arc") {
      // The graph stores the Bézier control point. Geometry stores the point
      // visited at t=1/2. Convert between those equivalent representations.
      points[1] = {
        x: (points[0].x + 2 * points[1].x + points[2].x) / 4,
        y: (points[0].y + 2 * points[1].y + points[2].y) / 4,
      };
    }
    const ids = points.map((point, i) => {
      const pointId = shape.kind === "point" && i === 0 ? id : `${id}:${i}`;
      objects.push({ ...point, id: pointId, type: "point", hidden: shape.kind !== "point",
        ...(shape.kind === "point" && shape.label ? { label: shape.label } : {}) });
      return pointId;
    });
    if (shape.kind === "line") objects.push({ id, type: "segment", a: ids[0], b: ids[1], label: shape.label });
    if (shape.kind === "polygon") objects.push({ id, type: "polygon", points: ids, label: shape.label, fill: "color-mix(in srgb, currentColor 10%, transparent)" });
    if (shape.kind === "arc") objects.push({ id, type: "curve", a: ids[0], mid: ids[1], b: ids[2] });
    if (shape.kind === "circle") objects.push({ id, type: "circle", center: ids[0], rim: ids[1],
      r: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) });
    if (shape.label && shape.kind !== "point" && shape.kind !== "line") {
      objects.push({ id: `${id}:name`, type: "label", ownerId: id,
        x: points[0].x + 6, y: points[0].y - 8, text: shape.label });
    }
  }
  const stored = sanitizeScene(raw.scene);
  return { bounds: { width, height }, objects, meta: stored?.meta };
}
