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
 * Where the next object goes along a road (0–1): after everything already on it,
 * so hallways and doors interleave in the order they were added.
 */
export function nextObjectOffset(existing: number[]): number {
  const last = existing.length ? Math.max(...existing) : 0;
  return Math.min(0.94, Math.max(0.12, last + 0.16));
}

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
 * One source of truth for the cut geometry, so the 3D opening, the solid wall
 * runs either side of it and the map junction can never disagree.
 */
export function openingFootprint(hallWidth: number): OpeningFootprint {
  return {
    width: Math.max(4.5, hallWidth * 1.15),
    jambDepth: 0.85,
    jambWidth: 0.34,
    soffit: 0.55,
    splay: BRANCH_ANGLE,
  };
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
 * Branch directions still free on a hallway. A hallway is a road, so it takes
 * at most one left and one right branch (and no user-chosen "extend").
 */
export function freeBranchDirections(
  walkways: BuildingWalkway[],
  parentId: string,
): WalkwayDirection[] {
  const taken = walkways.filter((w) => w.parent_id === parentId).map((w) => w.direction);
  return (["left", "right"] as WalkwayDirection[]).filter((d) => !taken.includes(d));
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

export type HallwayObjectKind = "door" | "opening";

/** One navigable object attached to a hallway: a door, or a sub-hallway opening. */
export interface HallwayObject {
  kind: HallwayObjectKind;
  /** door id, or child walkway id for an opening */
  id: string;
  name: string;
  /** -1 = left wall, +1 = right wall */
  side: -1 | 1;
  /** distance from the hallway start, in world units */
  along: number;
  /** for openings only: which wall the branch leaves through */
  direction?: WalkwayDirection;
}

export interface LayoutInput {
  length: number;
  doors: { id: string; name: string; order: number }[];
  /** child walkways; "forward" children are continuations, not objects */
  openings: { id: string; name: string; direction: WalkwayDirection; order: number }[];
  /** minimum distance between two objects along the corridor */
  minGap?: number;
  /** clearance kept at the start and end of the corridor */
  pad?: number;
}

/**
 * Place doors and sub-hallway openings along one hallway.
 *
 * Rules enforced here (and only here — the 3D scene and the minimap both read
 * this function, so they can never disagree):
 *  - forward children are the hallway continuing, never an object;
 *  - openings sit on the wall their branch leaves through;
 *  - doors alternate to the opposite wall from the previous object;
 *  - every object gets its own distance along the corridor, at least `minGap`
 *    apart, so two clickable objects are never directly opposite each other.
 */
export function layoutHallwayObjects({
  length,
  doors,
  openings,
  minGap = 4,
  pad = 3,
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
  ].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  if (seq.length === 0) return [];

  const usable = Math.max(minGap, length - pad * 2);
  const gap = Math.max(minGap, usable / seq.length);
  let lastSide: -1 | 1 = 1; // so the first object lands on the left wall

  return seq.map((item, i) => {
    const side: -1 | 1 =
      item.kind === "opening" ? (item.direction === "left" ? -1 : 1) : (-lastSide as -1 | 1);
    lastSide = side;
    const along = Math.min(length - 0.5, pad + gap * (i + 0.5));
    return item.kind === "opening"
      ? { kind: item.kind, id: item.id, name: item.name, side, along, direction: item.direction }
      : { kind: item.kind, id: item.id, name: item.name, side, along };
  });
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