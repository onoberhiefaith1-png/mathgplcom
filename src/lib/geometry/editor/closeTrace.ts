/**
 * AREA-005 — one way to close an Area trace.
 *
 * A traced region can be closed three ways: clicking back on the first point,
 * double-clicking, or pressing Enter. All three must produce exactly the same
 * region: the teacher's chosen fill colour and density, and a selectable region
 * id so the workflow can finish with it selected.
 *
 * Previously only the click-on-first-point path passed the chosen options, so
 * double-click and Enter silently fell back to the engine defaults. This module
 * is the single source of that behaviour and is covered by tests.
 */
import type { GeoId, GeometryScene } from "../scene";
import { addCurvedRegion, addRegion, patchObject, type OpResult } from "./sceneOps";

export interface CloseTraceOptions {
  /** Curve mode groups the traced points into overlapping triplets. */
  curveMode: boolean;
  fill: string;
  opacity: number;
}

export interface ClosedTrace {
  /** Scene after the region (and, in curve mode, its curves) was added. */
  scene: GeometryScene;
  /** The created region, or null when the trace could not be closed. */
  regionId: GeoId | null;
  /** Every op that must be applied, in order, so history stays truthful. */
  ops: OpResult[];
}

/**
 * Closes a traced boundary and returns the region carrying the chosen fill and
 * density. Fewer than three points cannot enclose anything, so the scene is
 * returned untouched with `regionId: null`.
 */
export function closeAreaTrace(
  scene: GeometryScene,
  pointIds: GeoId[],
  { curveMode, fill, opacity }: CloseTraceOptions,
): ClosedTrace {
  if (pointIds.length < 3) return { scene, regionId: null, ops: [] };

  if (!curveMode) {
    const op = addRegion(scene, pointIds, { fill, opacity });
    const regionId = op.addedIds[0] ?? null;
    return { scene: op.scene, regionId, ops: [op] };
  }

  // Curve mode builds the curves first, so the fill has to be patched onto the
  // resulting region rather than passed in.
  const op = addCurvedRegion(scene, pointIds);
  const regionId = op.addedIds[0] ?? null;
  if (!regionId) return { scene: op.scene, regionId: null, ops: [op] };
  const patched = patchObject(op.scene, regionId, { fill, opacity } as never);
  return { scene: patched.scene, regionId, ops: [op, patched] };
}
