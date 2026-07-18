// GeometryScene v2 — clean rebuild around the five construction tools:
// Point, Line, Circle, Arc, Curve. Everything references point ids so that
// dragging a point automatically reshapes every connected object.
//
// Phase 1 uses only Point objects. Later phases add Line/Circle/Arc/Curve
// and derived Regions without changing this file's shape.

export type V2Id = string;

export type V2Color = string;
export type V2Style = "solid" | "dotted" | "dashed";

export interface V2Point {
  id: V2Id;
  type: "point";
  x: number;
  y: number;
  labelText: string;
  /** Offset from the point to the label, in scene units. */
  labelOffset: { dx: number; dy: number };
  color: V2Color;
  labelColor?: V2Color;
  hidden?: boolean;
}

export interface V2Line {
  id: V2Id;
  type: "line";
  aId: V2Id;
  bId: V2Id;
  style: V2Style;
  arrow: "none" | "end" | "start" | "both";
  marks: 0 | 1 | 2 | 3 | 4;
  parallel: 0 | 1 | 2 | 3;
  distanceText?: string;
  distancePos?: { dx: number; dy: number };
  color: V2Color;
  labelText?: string;
  labelOffset?: { dx: number; dy: number };
}

export interface V2Circle {
  id: V2Id;
  type: "circle";
  centerId: V2Id;
  radiusId: V2Id;
  style: V2Style;
  color: V2Color;
  thickness: number;
  labelText?: string;
  labelOffset?: { dx: number; dy: number };
}

export interface V2Arc {
  id: V2Id;
  type: "arc";
  startId: V2Id;
  centerId: V2Id;
  endId: V2Id;
  style: V2Style;
  color: V2Color;
  thickness: number;
  labelText?: string;
  labelOffset?: { dx: number; dy: number };
}

export interface V2Curve {
  id: V2Id;
  type: "curve";
  pointIds: V2Id[];
  style: V2Style;
  color: V2Color;
  thickness: number;
  labelText?: string;
  labelOffset?: { dx: number; dy: number };
}

export type V2Object = V2Point | V2Line | V2Circle | V2Arc | V2Curve;

export interface V2Scene {
  version: 2;
  bounds: { width: number; height: number };
  objects: V2Object[];
}

export const EMPTY_V2_SCENE: V2Scene = {
  version: 2,
  bounds: { width: 480, height: 320 },
  objects: [],
};

export function isV2Scene(x: unknown): x is V2Scene {
  if (!x || typeof x !== "object") return false;
  const s = x as { version?: unknown; bounds?: unknown; objects?: unknown };
  return s.version === 2 && !!s.bounds && Array.isArray(s.objects);
}

// ---------- ID + label generators ----------

let idCounter = 0;
export function newId(prefix: string): V2Id {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Next free point label — A, B, …, Z, then A1, B1, … */
export function nextPointLabel(scene: V2Scene): string {
  const used = new Set<string>();
  for (const o of scene.objects) {
    if (o.type === "point" && o.labelText) used.add(o.labelText);
  }
  for (const ch of ALPHA) if (!used.has(ch)) return ch;
  let n = 1;
  while (true) {
    for (const ch of ALPHA) {
      const cand = `${ch}${n}`;
      if (!used.has(cand)) return cand;
    }
    n++;
  }
}

// ---------- lookups ----------

export function findObject(scene: V2Scene, id: V2Id): V2Object | null {
  return scene.objects.find((o) => o.id === id) ?? null;
}
export function findPoint(scene: V2Scene, id: V2Id): V2Point | null {
  const o = findObject(scene, id);
  return o && o.type === "point" ? o : null;
}

// ---------- immutable operations ----------

export function addPoint(
  scene: V2Scene,
  x: number,
  y: number,
  overrides: Partial<Omit<V2Point, "id" | "type" | "x" | "y">> = {},
): { scene: V2Scene; id: V2Id } {
  const id = newId("p");
  const p: V2Point = {
    id,
    type: "point",
    x,
    y,
    labelText: overrides.labelText ?? nextPointLabel(scene),
    labelOffset: overrides.labelOffset ?? { dx: 8, dy: -8 },
    color: overrides.color ?? "#1f1f24",
    labelColor: overrides.labelColor,
    hidden: overrides.hidden,
  };
  return { scene: { ...scene, objects: [...scene.objects, p] }, id };
}

export function updateObject(
  scene: V2Scene,
  id: V2Id,
  patch: Partial<V2Object>,
): V2Scene {
  return {
    ...scene,
    objects: scene.objects.map((o) => (o.id === id ? ({ ...o, ...patch } as V2Object) : o)),
  };
}

export function movePoint(scene: V2Scene, id: V2Id, x: number, y: number): V2Scene {
  return updateObject(scene, id, { x, y } as Partial<V2Point>);
}

export function deleteObject(scene: V2Scene, id: V2Id): V2Scene {
  // Also drop any object that references the deleted point.
  const objects = scene.objects.filter((o) => {
    if (o.id === id) return false;
    switch (o.type) {
      case "line": return o.aId !== id && o.bId !== id;
      case "circle": return o.centerId !== id && o.radiusId !== id;
      case "arc": return o.startId !== id && o.centerId !== id && o.endId !== id;
      case "curve": return !o.pointIds.includes(id);
      default: return true;
    }
  });
  return { ...scene, objects };
}

// ---------- sanitisation ----------

export function sanitizeV2Scene(raw: unknown): V2Scene | null {
  if (!isV2Scene(raw)) return null;
  const bounds = {
    width: clamp(Number(raw.bounds.width) || 480, 80, 2000),
    height: clamp(Number(raw.bounds.height) || 320, 80, 2000),
  };
  const ids = new Set<string>();
  const objects: V2Object[] = [];
  for (const o of raw.objects) {
    if (!o || typeof o !== "object") continue;
    const oid = (o as { id?: unknown }).id;
    if (typeof oid !== "string" || ids.has(oid)) continue;
    ids.add(oid);
    objects.push(o as V2Object);
  }
  return { version: 2, bounds, objects };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
