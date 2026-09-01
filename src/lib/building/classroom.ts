/**
 * CLASSROOM SHELL GEOMETRY.
 *
 * Three architecturally different teaching structures — not one room scaled.
 * This module holds only measurements: the renderer builds the shell from
 * them, and nothing is placed inside (no smartboard, table, chairs, frames,
 * video or camera at this stage).
 */
import type { ClassroomKind } from "./types";

export interface ClassroomTier {
  /** distance from the entrance wall where this tier starts */
  from: number;
  /** distance from the entrance wall where this tier ends */
  to: number;
  /** floor height of the tier (0 = corridor level, negative = stepped down) */
  y: number;
}

export interface ClassroomDimensions {
  /** left-to-right size, metres */
  width: number;
  /** entrance-to-front-wall size, metres */
  length: number;
  /** floor-to-ceiling size at the entrance, metres */
  height: number;
  /** stepped tiers, entrance first. A flat room has a single tier at y = 0. */
  tiers: ClassroomTier[];
}

const flat = (width: number, length: number, height: number): ClassroomDimensions => ({
  width,
  length,
  height,
  tiers: [{ from: 0, to: length, y: 0 }],
});

/** Auditorium: the floor descends tier by tier toward the front teaching wall. */
const auditorium = (): ClassroomDimensions => {
  const width = 20;
  const length = 24;
  const tierCount = 6;
  const run = length / tierCount;
  const rise = 0.55;
  const tiers: ClassroomTier[] = [];
  for (let i = 0; i < tierCount; i += 1) {
    tiers.push({ from: i * run, to: (i + 1) * run, y: -i * rise });
  }
  return { width, length, height: 6.6, tiers };
};

export const CLASSROOM_DIMENSIONS: Record<ClassroomKind, ClassroomDimensions> = {
  // Compact teaching space: width and length are approximately equal.
  classroom: flat(9, 9.5, 5.4),
  // Same width as the compact classroom, about three times the length.
  teaching_hall: flat(9, 28, 5.4),
  auditorium: auditorium(),
};

export const classroomDimensions = (kind: ClassroomKind): ClassroomDimensions =>
  CLASSROOM_DIMENSIONS[kind] ?? CLASSROOM_DIMENSIONS.classroom;

/** Lowest floor height in the room — the front teaching area of an auditorium. */
export const classroomFloorLow = (kind: ClassroomKind): number =>
  Math.min(...classroomDimensions(kind).tiers.map((t) => t.y));

export const CLASSROOM_KIND_BLURB: Record<ClassroomKind, string> = {
  classroom: "Compact, roughly square teaching space for a small class.",
  teaching_hall: "Same width, about three times the length — a longer teaching room.",
  auditorium: "Large stepped space; the floor descends toward the front teaching area.",
};
