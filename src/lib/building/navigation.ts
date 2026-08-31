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

/** Rotate a heading left/right by 90° (or keep it). */
export const turnHeading = (h: [number, number], dir: WalkwayDirection): [number, number] => {
  if (dir === "forward") return h;
  const theta = dir === "left" ? Math.PI / 2 : -Math.PI / 2;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [h[0] * c + h[1] * s, -h[0] * s + h[1] * c];
};

/** Smoothstep easing for turns and door zooms. */
export const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/** Recursively compile the walkway tree into a navigable graph. */
export function compileNavGraph(walkways: BuildingWalkway[]): NavGraph {
  const nodes: NavNode[] = [];
  const byId = new Map<string, NavNode>();
  const childrenByParent = new Map<string | null, NavNode[]>();

  const walk = (
    w: BuildingWalkway,
    start: [number, number],
    heading: [number, number],
    depth: number,
    parentId: string | null,
    direction: WalkwayDirection | null,
  ): NavNode => {
    const node: NavNode = {
      id: w.id,
      walkwayId: w.id,
      parentId,
      direction,
      start,
      heading,
      length: w.length,
      depth,
    };
    nodes.push(node);
    byId.set(w.id, node);
    const end: [number, number] = [start[0] + heading[0] * w.length, start[1] + heading[1] * w.length];
    const kids = walkways
      .filter((x) => x.parent_id === w.id)
      .sort((a, b) => a.position - b.position);
    childrenByParent.set(w.id, kids.map((k) => walk(k, end, turnHeading(heading, k.direction), depth + 1, w.id, k.direction)));
    return node;
  };

  const roots = walkways.filter((w) => !w.parent_id).sort((a, b) => a.position - b.position);
  childrenByParent.set(
    null,
    roots.map((w) => walk(w, [0, 0], [0, -1], 0, null, null)),
  );
  return { nodes, byId, rootId: roots[0]?.id ?? null, childrenByParent };
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