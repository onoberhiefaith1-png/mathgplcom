/**
 * PURE BUILDING NAVIGATION — graph compilation, turn geometry and history.
 *
 * This module is intentionally free of React, Three.js and DOM access so the
 * walkway graph, direction availability and turn/retrace maths can be unit
 * tested in isolation. The 3D scene consumes it through the same primitives
 * it uses to render (segYaw / forwardFromYaw / turnHeading).
 */
import type { BuildingWalkway, WalkwayDirection } from "./types";

/** One walkway segment in graph form. */
export interface NavNode {
  id: string;
  walkwayId: string | null;
  parentId: string | null;
  /** Direction *from its parent* (null for the root walkway). */
  direction: WalkwayDirection | null;
  start: [number, number];
  heading: [number, number];
  length: number;
  depth: number;
}

export interface NavGraph {
  nodes: NavNode[];
  byId: Map<string, NavNode>;
  rootId: string | null;
  /** Children of a node id, ordered by stored position. */
  childrenByParent: Map<string | null, NavNode[]>;
}

/** World yaw (rotation about Y) that faces a heading. forward=(0,-1) → 0. */
export const segYaw = (h: [number, number]): number => Math.atan2(-h[0], -h[1]);

/** Unit forward vector for a yaw. */
export const forwardFromYaw = (yaw: number): [number, number] => [-Math.sin(yaw), -Math.cos(yaw)];

/** Heading pointing back the way a segment came. */
export const reverseHeading = (h: [number, number]): [number, number] => [-h[0], -h[1]];

/** Rotate a heading by an arbitrary angle (positive = to the player's left). */
export const rotateHeading = (h: [number, number], theta: number): [number, number] => {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [h[0] * c + h[1] * s, -h[0] * s + h[1] * c];
};

/** Rotate a heading left/right by 90° (or keep it). */
export const turnHeading = (h: [number, number], dir: WalkwayDirection): [number, number] => {
  if (dir === "forward") return h;
  return rotateHeading(h, dir === "left" ? Math.PI / 2 : -Math.PI / 2);
};

/**
 * A branch hallway leaves its parent at an OPEN DIAGONAL, not a right angle, so
 * from one standing position you see the hallway you are in and the connected
 * hallway through the same opening. 60° is the reference geometry.
 */
export const BRANCH_ANGLE = (60 * Math.PI) / 180;

/** Heading of a hallway branching off `h` on the given side. */
export const branchHeading = (h: [number, number], dir: WalkwayDirection): [number, number] => {
  if (dir === "forward") return h;
  return rotateHeading(h, dir === "left" ? BRANCH_ANGLE : -BRANCH_ANGLE);
};

/**
 * Which side the NEXT hallway added to a road takes. The teacher never chooses:
 * branches alternate right → left → right → left along the road, so a hallway
 * opening and a door can never end up directly opposite each other.
 */
export function nextBranchDirection(
  walkways: BuildingWalkway[],
  parentId: string,
): WalkwayDirection {
  const branches = walkways.filter((w) => w.parent_id === parentId && w.direction !== "forward");
  return branches.length % 2 === 0 ? "right" : "left";
}

/**
 * The ORDER KEY of the next object on a road (0–1). Physical distance is not
 * stored: slots are fixed and derived by `layoutHallwayObjects`, so this value
 * only has to sort a new object after everything already on that hallway.
 */
export function nextObjectOffset(existing: number[]): number {
  const last = existing.length ? Math.max(...existing) : 0;
  return Math.min(0.999, Math.max(0.02, last + 0.02));
}

/** Conceptual blockwork thickness of every hallway wall (metres). */
export const WALL_THICKNESS = 0.24;

/** Plan width of a hallway — the shared figure for geometry and merge solving. */
export const HALL_WIDTH = 7;

/** Physical size of a hallway-to-hallway cut-through in a wall. */
export interface OpeningFootprint {
  /** width of the gap measured along the parent wall */
  width: number;
  /** depth of the reveal returning into the branch (wall thickness) */
  jambDepth: number;
  /** wall thickness shown at the edges of the cut */
  jambWidth: number;
  /** height of the soffit beam spanning over the cut */
  soffit: number;
  /** angle the reveal is splayed to, matching the branch corridor */
  splay: number;
}

/**
 * THE JUNCTION SOLVER — one source of truth for a hallway-to-hallway
 * intersection, solved as two real corridor VOLUMES meeting at `angle`.
 *
 * Everything is expressed in the parent hallway's own plan coordinates:
 * `lateral` runs across the parent (positive towards the branch side) and
 * `along` runs forward down the parent from the junction point. The renderer
 * mirrors `lateral` by the branch side, so left and right junctions are the
 * same solved geometry.
 *
 * The branch corridor's two side walls cross the parent's wall plane at two
 * different distances, so the mouth is WIDER than the corridor (width / sinθ)
 * and its centre sits FORWARD of the junction point — a diagonal intersection
 * is never symmetric about the junction, which is why a perpendicular-style
 * hole never reads correctly.
 */
export interface JunctionGeometry {
  angle: number;
  wallThickness: number;
  /** span of the opening measured along the parent wall */
  mouthSpan: number;
  /** how far forward of the junction point the mouth's centre sits */
  mouthCenterOffset: number;
  /** distance along the branch axis where the branch's own shell may begin */
  branchTrim: number;
  /** upstream edge of the mouth, on the parent wall plane */
  mouthNear: [number, number];
  /** downstream edge of the mouth, on the parent wall plane */
  mouthFar: [number, number];
  /** where the branch's upstream wall begins, out in the branch */
  throatCorner: [number, number];
  /** height of the soffit beam carried over the mouth */
  soffit: number;
  /** breadth of the jamb block shown at each edge of the cut */
  jambWidth: number;
}

export function junctionGeometry(hallWidth: number, angle = BRANCH_ANGLE): JunctionGeometry {
  const half = hallWidth / 2;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  // Branch axis u = (sin, cos); its wall lines are u·s ± half·p, p = (cos, -sin).
  const sNear = (half * (1 - cos)) / sin;
  const sFar = (half * (1 + cos)) / sin;
  const mouthNear: [number, number] = [half, sNear * cos - half * sin];
  const mouthFar: [number, number] = [half, sFar * cos + half * sin];
  const throatCorner: [number, number] = [sFar * sin + half * cos, sFar * cos - half * sin];
  return {
    angle,
    wallThickness: WALL_THICKNESS,
    mouthSpan: mouthFar[1] - mouthNear[1],
    mouthCenterOffset: (mouthFar[1] + mouthNear[1]) / 2,
    branchTrim: sFar,
    mouthNear,
    mouthFar,
    throatCorner,
    soffit: 0.55,
    jambWidth: 0.34,
  };
}

/**
 * Legacy footprint view of the solved junction, kept so callers that only need
 * the wall gap can stay simple.
 */
export function openingFootprint(hallWidth: number): OpeningFootprint {
  const geo = junctionGeometry(hallWidth);
  return {
    width: geo.mouthSpan,
    jambDepth: geo.wallThickness,
    jambWidth: geo.jambWidth,
    soffit: geo.soffit,
    splay: geo.angle,
  };
}


/**
 * A corridor as a plan RECTANGLE: a centreline from `start` running `length`
 * along `heading`, with the hallway's width across it.
 */
export interface CorridorSpan {
  start: [number, number];
  heading: [number, number];
  length: number;
}

/**
 * Where two corridors physically CROSS, expressed as the interval each one
 * loses to the other along its own centreline. This is the one solver for the
 * over-under intersection: a crossing is a real footprint shared by two
 * corridor volumes, never two coplanar planes stacked at the same depth.
 *
 * `a` / `b` are distances measured from each corridor's own start. The interval
 * is the full plan overlap of the two rectangles projected on that centreline,
 * so cutting it out of one deck leaves exactly the other deck's slab showing.
 */
export interface CorridorCrossing {
  a: [number, number];
  b: [number, number];
}

export function corridorCrossing(
  a: CorridorSpan,
  b: CorridorSpan,
  hallWidth: number,
  /** how far past each end a deck is still considered present */
  pad = 3.2,
): CorridorCrossing | null {
  const [ux, uz] = a.heading;
  const [vx, vz] = b.heading;
  const det = vx * uz - ux * vz; // = sin of the angle between them
  if (Math.abs(det) < 1e-3) return null; // parallel roads never cross
  const dx = b.start[0] - a.start[0];
  const dz = b.start[1] - a.start[1];
  const t = (-dx * vz + vx * dz) / det;
  const s = (ux * dz - uz * dx) / det;

  const sin = Math.abs(det);
  const cos = Math.abs(ux * vx + uz * vz);
  // The two side walls of one corridor cut the other's axis at different
  // distances, so the shared footprint is wider than the corridor itself.
  const half = ((hallWidth / 2) * (1 + cos)) / sin;

  const aRange: [number, number] = [t - half, t + half];
  const bRange: [number, number] = [s - half, s + half];
  const touches = (r: [number, number], len: number) => r[1] > -pad && r[0] < len + pad;
  if (!touches(aRange, a.length) || !touches(bRange, b.length)) return null;
  return { a: aRange, b: bRange };
}


/**
 * The solid runs of one hallway wall once its cut-throughs are removed. The
 * wall genuinely STOPS at an opening — it is never a hole punched through a
 * single continuous plane.
 */
export function wallRuns(
  from: number,
  to: number,
  gaps: { along: number; width: number }[],
): [number, number][] {
  const holes = gaps
    .map((g) => [g.along - g.width / 2, g.along + g.width / 2] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const runs: [number, number][] = [];
  let cursor = from;
  for (const [a, b] of holes) {
    if (b <= cursor) continue;
    if (a > cursor) runs.push([cursor, Math.min(a, to)]);
    cursor = Math.max(cursor, b);
    if (cursor >= to) break;
  }
  if (cursor < to) runs.push([cursor, to]);
  return runs.filter(([a, b]) => b - a > 0.05);
}


/** Smoothstep easing for turns and door zooms. */
export const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/**
 * How long a hallway has to be to carry `count` objects (doors + junction
 * openings) comfortably. A hallway is a road: it grows by itself as things are
 * added to it, so there is never an "extend hallway" control.
 */
export function lengthForObjects(count: number, gap = 7.5, pad = 3): number {
  return Math.max(gap * 2, pad * 2 + Math.max(1, count) * gap);
}

/**
 * Where along its parent a branch leaves. A junction is perpendicular and sits
 * ON the parent road, not at its far end, so `junction_at` (0–1) is honoured.
 */
export const junctionDistance = (parentLength: number, junctionAt: number): number =>
  Math.min(parentLength - 0.5, Math.max(0.5, parentLength * Math.min(1, Math.max(0, junctionAt))));

/** Recursively compile the walkway tree into a navigable graph. */
export function compileNavGraph(
  walkways: BuildingWalkway[],
  /** Optional derived length per hallway id (auto-grown from its objects). */
  lengthOf?: (w: BuildingWalkway) => number,
): NavGraph {
  const nodes: NavNode[] = [];
  const byId = new Map<string, NavNode>();
  const childrenByParent = new Map<string | null, NavNode[]>();
  const len = (w: BuildingWalkway) => lengthOf?.(w) ?? w.length;

  const walk = (
    w: BuildingWalkway,
    start: [number, number],
    heading: [number, number],
    depth: number,
    parentId: string | null,
    direction: WalkwayDirection | null,
  ): NavNode => {
    const length = len(w);
    const node: NavNode = {
      id: w.id,
      walkwayId: w.id,
      parentId,
      direction,
      start,
      heading,
      length,
      depth,
    };
    nodes.push(node);
    byId.set(w.id, node);
    const kids = walkways
      .filter((x) => x.parent_id === w.id)
      .sort((a, b) => a.position - b.position);
    childrenByParent.set(
      w.id,
      kids.map((k) => {
        // A forward continuation carries on from the far end; a left/right
        // hallway leaves perpendicular from a junction along this road.
        const along =
          k.direction === "forward" ? length : junctionDistance(length, k.junction_at ?? 0.5);
        const at: [number, number] = [start[0] + heading[0] * along, start[1] + heading[1] * along];
        return walk(k, at, branchHeading(heading, k.direction), depth + 1, w.id, k.direction);
      }),
    );
    return node;
  };

  const roots = walkways.filter((w) => !w.parent_id).sort((a, b) => a.position - b.position);
  childrenByParent.set(
    null,
    roots.map((w) => walk(w, [0, 0], [0, -1], 0, null, null)),
  );
  return { nodes, byId, rootId: roots[0]?.id ?? null, childrenByParent };
}

/**
 * Branch directions available on a hallway. A road can carry as many junctions
 * as it has slots, so both sides always stay available — the side of the next
 * one is chosen automatically (see `nextBranchDirection`).
 */
export function freeBranchDirections(
  _walkways: BuildingWalkway[],
  _parentId: string,
): WalkwayDirection[] {
  return ["left", "right"];
}


export interface DirectionAvailability {
  forward: boolean;
  left: boolean;
  right: boolean;
  /** True when the node has a parent (can go back), or is not at its start. */
  back: boolean;
}

/** Which directions are valid from a node. A node is a junction when it has children. */
export function availableDirections(graph: NavGraph, nodeId: string | null): DirectionAvailability {
  const node = nodeId ? graph.byId.get(nodeId) : null;
  const kids = graph.childrenByParent.get(nodeId) ?? [];
  const forward = kids.some((k) => k.direction === "forward");
  const left = kids.some((k) => k.direction === "left");
  const right = kids.some((k) => k.direction === "right");
  return { forward, left, right, back: node?.parentId != null };
}

/** Geometry of a smooth 90° corner turn around a pivot. */
export interface TurnArc {
  pivot: [number, number];
  fromYaw: number;
  toYaw: number;
  radius: number;
}

export function turnArc(
  fromHeading: [number, number],
  toHeading: [number, number],
  pivot: [number, number],
): TurnArc {
  return {
    pivot,
    fromYaw: segYaw(fromHeading),
    toYaw: segYaw(toHeading),
    radius: 0.6,
  };
}

/** Geometry of a 180° in-place turnaround (used to begin retracing). */
export function turnaround(fromHeading: [number, number], at: [number, number]): TurnArc {
  return {
    pivot: at,
    fromYaw: segYaw(fromHeading),
    toYaw: segYaw(fromHeading) + Math.PI,
    radius: 0.25,
  };
}

/**
 * Where the "way back" marker sits inside a hallway you have just entered.
 *
 * Entering a side hallway never unloads the one you came from: the mouth you
 * walked through stays just behind you, so the parent hallway is marked with a
 * named connection sign a short inset from the child's start, facing back the
 * way you came.
 */
export interface ConnectionAnchor {
  position: [number, number];
  /** yaw of a sign whose face looks back toward the parent hallway */
  yaw: number;
}

export function parentConnectionAnchor(
  start: [number, number],
  heading: [number, number],
  inset = 1.2,
): ConnectionAnchor {
  return {
    position: [start[0] + heading[0] * inset, start[1] + heading[1] * inset],
    yaw: segYaw(reverseHeading(heading)),
  };
}


// ── Hallway object layout (single source of truth) ─────────────────────────

export type HallwayObjectKind = "door" | "opening" | "link";

/** One navigable object attached to a hallway: a door, a branch or a link. */
export interface HallwayObject {
  kind: HallwayObjectKind;
  /** door id, child walkway id for an opening, link id for a link */
  id: string;
  name: string;
  /** -1 = left wall, +1 = right wall */
  side: -1 | 1;
  /** distance from the hallway start, in world units */
  along: number;
  /** for openings only: which wall the branch leaves through */
  direction?: WalkwayDirection;
  /** for links only: the hallway on the other side of the connection */
  targetWalkwayId?: string;
}

export interface LayoutInput {
  doors: { id: string; name: string; order: number }[];
  /** child walkways; "forward" children are continuations, not objects */
  openings: { id: string; name: string; direction: WalkwayDirection; order: number }[];
  /** connections to hallways that already exist elsewhere (loops) */
  links?: { id: string; name: string; targetWalkwayId: string; order: number }[];
  /** fixed distance between two consecutive object slots */
  spacing?: number;
  /** clearance kept before the first slot (an entry run for a branch) */
  pad?: number;
}

/** Standard distance between any two objects along any hallway. */
export const OBJECT_SPACING = 7.5;
/** Clearance before the first object of the entrance hallway. */
export const HALLWAY_PAD = 4;
/**
 * Clearance before the first object of a hallway you walk INTO. A branch keeps
 * a longer entry run so its first door cannot be seen from the parent hallway —
 * you have to walk in to find it.
 */
export const HALLWAY_ENTRY_RUN = 12;

/**
 * Place doors, branch openings and links along one hallway.
 *
 * A hallway is a road with FIXED slots: slot n sits at `pad + n * spacing`, so
 * the distance between two objects never changes as the building grows, and the
 * road simply gets longer (see `hallwayLength`). Rules enforced here — and only
 * here, so the 3D scene and the map can never disagree:
 *  - forward children are the hallway continuing, never an object;
 *  - a branch opening sits on the wall its hallway leaves through;
 *  - doors alternate to the opposite wall from the previous object;
 *  - a door and an opening never take neighbouring slots: an empty slot is kept
 *    between them, so no door sits at a junction mouth.
 */
export function layoutHallwayObjects({
  doors,
  openings,
  links = [],
  spacing = OBJECT_SPACING,
  pad = HALLWAY_PAD,
}: LayoutInput): HallwayObject[] {
  const seq = [
    ...doors.map((d) => ({ kind: "door" as const, id: d.id, name: d.name, order: d.order })),
    ...openings
      .filter((o) => o.direction !== "forward")
      .map((o) => ({
        kind: "opening" as const,
        id: o.id,
        name: o.name,
        order: o.order,
        direction: o.direction,
      })),
    ...links.map((l) => ({
      kind: "link" as const,
      id: l.id,
      name: l.name,
      order: l.order,
      targetWalkwayId: l.targetWalkwayId,
    })),
  ].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  if (seq.length === 0) return [];

  const isMouth = (k: HallwayObjectKind) => k !== "door";
  let slot = 0;
  let lastSide: -1 | 1 = 1; // so the first object lands on the left wall
  let linkCount = 0;

  return seq.map((item, i) => {
    // Keep an empty slot whenever the kind changes between a door and a mouth,
    // so a clickable door is never adjacent to a hallway opening.
    if (i > 0 && isMouth(item.kind) !== isMouth(seq[i - 1].kind)) slot += 1;
    const along = pad + slot * spacing;
    slot += 1;

    let side: -1 | 1;
    if (item.kind === "opening") side = item.direction === "left" ? -1 : 1;
    else if (item.kind === "link") side = (linkCount++ % 2 === 0 ? 1 : -1) as -1 | 1;
    else side = -lastSide as -1 | 1;
    lastSide = side;

    if (item.kind === "opening")
      return { kind: item.kind, id: item.id, name: item.name, side, along, direction: item.direction };
    if (item.kind === "link")
      return {
        kind: item.kind,
        id: item.id,
        name: item.name,
        side,
        along,
        targetWalkwayId: item.targetWalkwayId,
      };
    return { kind: item.kind, id: item.id, name: item.name, side, along };
  });
}

/**
 * How long a road has to be to carry its objects. The road is derived from what
 * sits on it, so adding a door or a hallway extends it automatically and there
 * is never an "extend hallway" control.
 */
export function hallwayLength(
  objects: HallwayObject[],
  pad = HALLWAY_PAD,
  spacing = OBJECT_SPACING,
): number {
  const last = objects.length ? Math.max(...objects.map((o) => o.along)) : 0;
  return Math.max(pad + spacing, last + Math.max(pad, spacing * 0.8));
}

/** Closest two object slots may ever sit on a road that had to be shortened. */
export const MIN_OBJECT_SPACING = 2.4;

/**
 * JUNCTION CLEARANCE. The run of a hallway immediately before the junction it
 * makes is architectural crossing space: no door, no branch mouth and no plaque
 * may sit inside it, so nothing ever appears to stand in the middle of the road
 * where two hallways meet.
 */
export const JUNCTION_CLEAR = 4.5;

/** Width of the hole a road arriving at `sinAngle` cuts in the wall it meets. */
export function mouthSpanFor(hallWidth: number, sinAngle: number): number {
  const sin = Math.max(0.28, Math.min(1, Math.abs(sinAngle)));
  return Math.min(hallWidth * 3, hallWidth / sin);
}

/**
 * FIT OBJECTS INTO A SHORTENED ROAD.
 *
 * A road that merges into another one is exactly as long as the space it had, so
 * it can be shorter than its objects would normally need. Nothing is dropped and
 * nothing lands in the crossing: the slots are squeezed into the run BEFORE the
 * junction clearance (down to `MIN_OBJECT_SPACING`), and doors alternate walls
 * so both sides of the corridor are used before the spacing is reduced.
 */
export function fitObjectsToLength(
  objects: HallwayObject[],
  length: number,
  pad = HALLWAY_PAD,
  spacing = OBJECT_SPACING,
  clear = JUNCTION_CLEAR,
): HallwayObject[] {
  if (objects.length === 0) return objects;
  const sorted = [...objects].sort((a, b) => a.along - b.along);
  // The far end belongs to the junction: objects stop short of it entirely.
  const usable = Math.max(0, length - Math.max(clear, spacing * 0.5));
  const last = sorted[sorted.length - 1].along;
  if (last <= usable) return objects;

  const gaps = sorted.length - 1;
  const first = Math.min(pad, Math.max(usable * 0.15, 0));
  let step = gaps > 0 ? (usable - first) / gaps : 0;
  let start = first;
  if (gaps > 0 && step < MIN_OBJECT_SPACING) {
    step = MIN_OBJECT_SPACING;
    start = Math.max(0, Math.min(first, usable - step * gaps));
  }
  const placed = new Map<string, number>();
  sorted.forEach((o, i) => placed.set(`${o.kind}:${o.id}`, Math.max(0, start + i * step)));

  // Doors alternate walls once the run is compressed, so a tight hallway reads
  // as a two-sided corridor instead of a queue of doors on one wall. Mouths keep
  // the wall their hallway actually leaves through.
  const sides = new Map<string, -1 | 1>();
  let next: -1 | 1 = -1;
  for (const o of sorted) {
    if (o.kind !== "door") {
      next = -o.side as -1 | 1;
      continue;
    }
    sides.set(`${o.kind}:${o.id}`, next);
    next = -next as -1 | 1;
  }

  return objects.map((o) => {
    const k = `${o.kind}:${o.id}`;
    return { ...o, along: placed.get(k) ?? o.along, side: sides.get(k) ?? o.side };
  });
}

// ── Connector corridors (Connect Hallway) ─────────────────────────────────

/** A road in plan form: where it starts, which way it runs and how long it is. */
export interface RoadLine {
  start: [number, number];
  heading: [number, number];
  length: number;
}

/**
 * Where a CONNECTOR corridor meets an existing hallway.
 *
 * A connector is a real road: it leaves one hallway through a junction mouth and
 * runs until it reaches the hallway it connects to, where it STOPS — it never
 * passes through it. This solves the two centre lines, so the corridor's length
 * is trimmed at the target's near wall and the target gains a mouth at the exact
 * meeting point.
 */
export interface ConnectorMeeting {
  /** trimmed corridor length: it stops at the target hallway's near wall */
  length: number;
  /** distance along the TARGET hallway where the mouth opens */
  alongTarget: number;
  /** which of the target's walls the corridor arrives at (-1 left, +1 right) */
  targetSide: -1 | 1;
  /** centre-line distance to the geometric crossing, before near-wall clipping */
  crossingDistance: number;
}

/**
 * CONNECTION TOLERANCE. Two roads that come this close are the SAME piece of
 * the maze: tiny positioning differences must never stop a junction from
 * forming, because a corridor that "nearly" reaches another one would otherwise
 * be left occupying the same ground.
 */
export const JUNCTION_TOLERANCE = 1.6;

/** Shortest run a merged road keeps, so a junction always has an approach. */
const MIN_MERGE_RUN = 0.02;

export function connectorMeeting(
  corridor: { start: [number, number]; heading: [number, number] },
  target: RoadLine,
  hallWidth: number,
  tolerance = JUNCTION_TOLERANCE,
): ConnectorMeeting | null {
  const [cx, cz] = corridor.start;
  const [chx, chz] = corridor.heading;
  const [tx, tz] = target.start;
  const [thx, thz] = target.heading;
  const half = hallWidth / 2;
  const sinAngle = Math.abs(chx * thz - chz * thx);
  // Which side of the target the corridor comes from: sign of the cross product
  // of the target's heading with the corridor's approach.
  const cross = thx * -chz - thz * -chx;
  const side: -1 | 1 = cross >= 0 ? 1 : -1;
  /** mouth position clamped to a run of the target that can actually hold it */
  const mouthAt = (s: number) =>
    Math.min(Math.max(s, half), Math.max(half, target.length - half));

  if (sinAngle < 1e-3) {
    // PARALLEL / RETURNING ROADS. There is no crossing point to solve, so the
    // merge is decided by proximity: a road running back alongside one that
    // already exists must stop where it enters that road's footprint.
    const rx = cx - tx;
    const rz = cz - tz;
    const lateral = rx * -thz + rz * thx; // signed distance across the target
    const gap = Math.abs(lateral) - hallWidth;
    if (gap > tolerance) return null; // they never share ground
    const alongAt = (d: number) => (rx + chx * d) * thx + (rz + chz * d) * thz;
    const dir = chx * thx + chz * thz >= 0 ? 1 : -1;
    // Distance along this road at which it enters the target's own extent.
    const enterAlong = dir > 0 ? -half : target.length + half;
    const entry = Math.max(0, (enterAlong - alongAt(0)) / dir);

    const trimmed = Math.max(MIN_MERGE_RUN, entry - half);
    const s = mouthAt(alongAt(trimmed));
    return {
      length: trimmed,
      alongTarget: s,
      targetSide: lateral >= 0 ? 1 : -1,
      crossingDistance: Math.max(entry, trimmed),
    };
  }

  const det = chx * -thz - chz * -thx;
  const rx = tx - cx;
  const rz = tz - cz;
  // Solve  corridor.start + t*ch = target.start + s*th
  const t = (rx * -thz - rz * -thx) / det;
  const s = (chx * rz - chz * rx) / det;
  if (t <= 0) return null; // the target sits behind this road, not ahead of it
  if (s < -half - tolerance || s > target.length + half + tolerance) return null;
  // The distance from the centre-line crossing to the near wall depends on the
  // angle between the roads. `half` only works at 90° and lets a 60° corridor
  // run visibly through the target. Include the target wall's outside face so
  // the approaching shell ends flush against real blockwork.
  const nearWallRun = (half + WALL_THICKNESS / 2) / sinAngle;
  // A road that already overlaps the target is not "too close to merge": it is
  // pulled back so it ends flush against the wall it reached.
  const trimmed = Math.max(MIN_MERGE_RUN, t - nearWallRun);
  return {
    length: trimmed,
    alongTarget: mouthAt(s),
    targetSide: side,
    crossingDistance: t,
  };
}


/**
 * WALKWAYS CAN NEVER CROSS THROUGH ONE ANOTHER.
 *
 * A road that grows towards a road that already exists must STOP at the wall it
 * reaches and merge into a junction there. This solves one road against every
 * other road in the plan and returns the first one it would enter, together with
 * the trimmed length and the exact mouth position on the road it met.
 *
 * `exclude` carries the ids a road is allowed to touch: its own parent (whose
 * mouth it begins in) and its own children (which begin in its walls).
 */
export interface RoadMeeting extends ConnectorMeeting {
  /** the road that stops this one */
  targetId: string;
}

export function firstRoadMeeting(
  road: { id: string; start: [number, number]; heading: [number, number]; length: number },
  others: (RoadLine & { id: string })[],
  hallWidth: number,
  exclude: Set<string> = new Set(),
): RoadMeeting | null {
  const hits: RoadMeeting[] = [];
  for (const other of others) {
    if (other.id === road.id || exclude.has(other.id)) continue;
    const meet = connectorMeeting({ start: road.start, heading: road.heading }, other, hallWidth);
    if (!meet) continue;
    // Only a road it would actually run INTO is a merge. A meeting further away
    // than this road reaches (beyond the connection tolerance) is simply two
    // roads that never touch.
    if (meet.crossingDistance > road.length + JUNCTION_TOLERANCE) continue;

    hits.push({ ...meet, targetId: other.id });
  }
  hits.sort((a, b) => a.length - b.length);
  return hits[0] ?? null;
}

/**
 * How long each hallway is ALLOWED to be before it runs into another hallway.
 *
 * A road that merges into another road is finite: it cannot keep growing as
 * objects are added, because past the junction there is another hallway. The
 * editor uses this to refuse growth instead of letting a walkway tunnel through.
 */
export interface MergeLimit {
  /** trimmed length of the arriving hallway */
  limit: number;
  /** the hallway it merges into */
  targetId: string;
}

export function mergeLimits(
  walkways: BuildingWalkway[],
  hallWidth: number,
  lengthOf?: (w: BuildingWalkway) => number,
): Map<string, MergeLimit> {
  const graph = compileNavGraph(walkways, lengthOf);
  const roads = graph.nodes.map((n) => ({
    id: n.id,
    start: n.start,
    heading: n.heading,
    length: n.length,
  }));
  const descendants = (id: string): string[] => {
    const kids = graph.childrenByParent.get(id) ?? [];
    return kids.flatMap((k) => [k.id, ...descendants(k.id)]);
  };
  const out = new Map<string, MergeLimit>();
  for (const n of [...graph.nodes].sort((a, b) => a.depth - b.depth)) {
    const own = new Set<string>([n.id, ...descendants(n.id)]);
    if (n.parentId) own.add(n.parentId);
    const meet = firstRoadMeeting(
      { id: n.id, start: n.start, heading: n.heading, length: n.length },
      roads,
      hallWidth,
      own,
    );
    if (meet && meet.length < n.length - 0.05) {
      out.set(n.id, { limit: meet.length, targetId: meet.targetId });
    }
  }
  return out;
}

/**
 * Insert a mouth whose position comes from GEOMETRY (a connector arriving from
 * another hallway) into a hallway's object layout, pushing any door that would
 * otherwise sit at the junction edge one slot further down the road.
 */
export function insertGeometricMouth(
  objects: HallwayObject[],
  mouth: HallwayObject,
  spacing = OBJECT_SPACING,
): HallwayObject[] {
  const clear = spacing * 0.9;
  const shifted = objects.map((o) => {
    if (o.kind !== "door") return o;
    let along = o.along;
    let guard = 0;
    while (Math.abs(along - mouth.along) < clear && guard++ < 8) along += spacing;
    return along === o.along ? o : { ...o, along };
  });
  return [...shifted, mouth].sort((a, b) => a.along - b.along);
}


/**
 * Navigation history — a stack of visited node ids (root first). Branch turns
 * push, retracing pops, so the stack is always the path from the entrance.
 */
export class NavigationHistory {
  private stack: string[] = [];

  push(id: string): void {
    this.stack.push(id);
  }

  pop(): string | undefined {
    return this.stack.pop();
  }

  peek(): string | undefined {
    return this.stack[this.stack.length - 1];
  }

  get length(): number {
    return this.stack.length;
  }

  get path(): readonly string[] {
    return this.stack;
  }

  clear(): void {
    this.stack = [];
  }
}
// ── Junction reachability ─────────────────────────────────────────────────
/**
 * WHAT CAN I ENTER FROM HERE?
 *
 * The maze is a connected graph of roads, so the answer depends only on where
 * the walker stands and which way they travel — never on where they have
 * already been. A junction may be entered any number of times, from either
 * side, so turning around never makes a junction inaccessible.
 */
export interface JunctionCandidateInput {
  /** openings and links attached to the hallway being walked (doors ignored) */
  objects: { kind: HallwayObjectKind; id: string; name: string; side: -1 | 1; along: number }[];
  /** physical length of the hallway being walked */
  length: number;
  /** the walker's distance along that hallway */
  dist: number;
  /** 1 = travelling with the hallway heading, -1 = travelling back down it */
  dir: 1 | -1;
  /** the hallway (or connector target) this road continues into at its far end */
  forward?: { id: string; name: string } | null;
  /** the junction this hallway left from, sitting at distance 0 */
  parent?: { id: string; name: string } | null;
  /** how close a junction must be to be enterable (default ENTER_RANGE) */
  range?: number;
}

export interface JunctionCandidate {
  key: string;
  kind: "branch" | "link" | "forward" | "parent";
  label: string;
  side: -1 | 0 | 1;
  targetId: string;
  /** metres ahead of the walker */
  distance: number;
}

export const JUNCTION_ENTER_RANGE = 6;

/** Everything enterable AHEAD of the walker, nearest first. */
export function resolveJunctionCandidates(input: JunctionCandidateInput): JunctionCandidate[] {
  const range = input.range ?? JUNCTION_ENTER_RANGE;
  const raw: JunctionCandidate[] = [];

  for (const o of input.objects) {
    if (o.kind === "door") continue;
    raw.push({
      key: `${o.kind}:${o.id}`,
      kind: o.kind === "link" ? "link" : "branch",
      label: o.name,
      side: o.side,
      targetId: o.id,
      distance: (o.along - input.dist) * input.dir,
    });
  }
  if (input.forward) {
    raw.push({
      key: `forward:${input.forward.id}`,
      kind: "forward",
      label: input.forward.name,
      side: 0,
      targetId: input.forward.id,
      distance: (input.length - input.dist) * input.dir,
    });
  }
  if (input.parent) {
    raw.push({
      key: `parent:${input.parent.id}`,
      kind: "parent",
      label: input.parent.name,
      side: 0,
      targetId: input.parent.id,
      distance: (0 - input.dist) * input.dir,
    });
  }

  return raw
    .filter((c) => c.distance > -0.5 && c.distance <= range)
    .sort((a, b) => a.distance - b.distance);
}
