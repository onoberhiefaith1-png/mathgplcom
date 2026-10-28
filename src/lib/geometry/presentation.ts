import type { GeoObject, GeometryScene } from "@/lib/geometry/scene";

const pointRefs = (object: GeoObject): string[] => {
  switch (object.type) {
    case "segment":
    case "line":
    case "ray":
      return [object.a, object.b];
    case "circle":
      return [object.center, ...(object.rim ? [object.rim] : [])];
    case "arc":
      return [object.center];
    case "angle":
      return [object.vertex, object.a, object.b];
    case "polygon":
      return object.points;
    case "curve":
      return object.points ?? [object.a, object.mid, object.b].filter((id): id is string => Boolean(id));
    case "region":
      return object.boundary;
    default:
      return [];
  }
};

const objectY = (object: GeoObject, pointY: Map<string, number>): number | null => {
  if (object.type === "point" || object.type === "label") return object.y;
  const ys = pointRefs(object).map((id) => pointY.get(id)).filter((y): y is number => y !== undefined);
  if (!ys.length) return null;
  return ys.reduce((sum, y) => sum + y, 0) / ys.length;
};

/**
 * A page-layer scene uses notebook coordinates and may contain diagrams drawn
 * hundreds of pixels apart. On a projected board those empty page regions must
 * not shrink the actual constructions into thumbnails. Split only at large
 * vertical gaps, retaining every construction object and its referenced points.
 */
export const splitPageGeometryScene = (
  scene: GeometryScene,
  gap = 160,
): GeometryScene[] => {
  if (!scene?.objects?.length) return [];
  const parent = new Map(scene.objects.map((object) => [object.id, object.id]));
  const root = (id: string): string => {
    const p = parent.get(id) ?? id;
    if (p === id) return id;
    const r = root(p);
    parent.set(id, r);
    return r;
  };
  const union = (a: string, b: string) => {
    if (!parent.has(a) || !parent.has(b)) return;
    const ra = root(a), rb = root(b);
    if (ra !== rb) parent.set(rb, ra);
  };
  for (const object of scene.objects) {
    for (const ref of pointRefs(object)) union(object.id, ref);
  }
  const components = new Map<string, GeoObject[]>();
  for (const object of scene.objects) {
    // Hidden, unreferenced construction debris is not visible in either the
    // note or board and must not expand the presentation viewport.
    if (object.type === "point" && object.hidden && root(object.id) === object.id && !scene.objects.some((o) => pointRefs(o).includes(object.id))) continue;
    const key = root(object.id);
    components.set(key, [...(components.get(key) ?? []), object]);
  }
  const pointY = new Map(
    scene.objects
      .filter((o): o is Extract<GeoObject, { type: "point" }> => o.type === "point")
      .map((p) => [p.id, p.y]),
  );
  const positioned = [...components.values()].map((objects) => {
    const ys = objects.map((object) => objectY(object, pointY)).filter((y): y is number => y !== null);
    return { objects, min: Math.min(...ys), max: Math.max(...ys) };
  }).filter((component) => Number.isFinite(component.min)).sort((a, b) => a.min - b.min);
  if (!positioned.length) return [scene];

  const bands: Array<{ min: number; max: number; objects: GeoObject[] }> = [];
  for (const component of positioned) {
    const current = bands[bands.length - 1];
    if (!current || component.min - current.max > gap) bands.push({ ...component });
    else {
      current.max = Math.max(current.max, component.max);
      current.objects.push(...component.objects);
    }
  }
  return bands.map(({ objects }) => ({ ...scene, bounds: { width: 0, height: 0 }, objects }));
};