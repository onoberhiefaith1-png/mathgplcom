/**
 * Validation test for the Area requirements (AREA-001 … AREA-006).
 *
 * These assertions pin the ENGINE layer of the Area tool: turning a traced
 * boundary or a picked set of boundary lines into a filled region object with
 * the chosen colour and density. They are the restoration source for the Area
 * engine — if they fail, region construction itself regressed. They do not
 * cover the pointer/UI layer, which is checked in the browser.
 */
import { describe, it, expect } from "vitest";
import { EMPTY_SCENE, type GeometryScene, type GeoRegion } from "../scene";
import { addPoint, addSegment, addRegion, addCurvedRegion } from "../editor/sceneOps";
import { cycleFromSegments } from "../editor/regions";
import { regionEdgesToPath } from "../editor/boundary";

/** Build a scene with the given points, returning ids in insertion order. */
function withPoints(pts: Array<[number, number]>) {
  let scene: GeometryScene = { ...EMPTY_SCENE, objects: [] };
  const ids: string[] = [];
  for (const [x, y] of pts) {
    const op = addPoint(scene, x, y);
    scene = op.scene;
    ids.push(op.addedIds[0]);
  }
  return { scene, ids };
}

function triangle() {
  const { scene, ids } = withPoints([[20, 20], [140, 20], [80, 120]]);
  return { scene, ids };
}

describe("AREA-002 — manual straight trace creates a filled region", () => {
  it("creates one region carrying the chosen fill and opacity", () => {
    const { scene, ids } = triangle();
    const op = addRegion(scene, ids, { fill: "#ff0000", opacity: 0.4 });
    expect(op.addedIds).toHaveLength(1);
    const region = op.scene.objects.find((o) => o.id === op.addedIds[0]) as GeoRegion;
    expect(region.type).toBe("region");
    expect(region.boundary).toEqual(ids);
    expect(region.fill).toBe("#ff0000");
    expect(region.opacity).toBe(0.4);
  });

  it("refuses a boundary with fewer than three points", () => {
    const { scene, ids } = triangle();
    const op = addRegion(scene, ids.slice(0, 2));
    expect(op.addedIds ?? []).toHaveLength(0);
    expect(op.scene.objects.some((o) => o.type === "region")).toBe(false);
  });

  it("stores per-edge geometry so the fill can be drawn", () => {
    const { scene, ids } = triangle();
    const op = addRegion(scene, ids);
    const region = op.scene.objects.find((o) => o.type === "region") as GeoRegion;
    expect(region.edges).toHaveLength(3);
    const path = regionEdgesToPath(op.scene, region.boundary, region.edges, 0);
    expect(typeof path).toBe("string");
    expect(path.length).toBeGreaterThan(0);
  });
});

describe("AREA-003 — curved trace creates a curved region", () => {
  it("builds a region from overlapping point triplets", () => {
    const { scene, ids } = withPoints([[10, 10], [60, 0], [110, 10], [110, 90], [10, 90]]);
    const op = addCurvedRegion(scene, ids);
    expect(op.addedIds.length).toBeGreaterThan(0);
    const region = op.scene.objects.find((o) => o.type === "region") as GeoRegion;
    expect(region).toBeTruthy();
    expect(op.scene.objects.some((o) => o.type === "curve")).toBe(true);
  });
});

describe("AREA-004 — enclosed region from picked boundary lines", () => {
  it("closes a cycle once every boundary line is picked", () => {
    const { scene, ids } = triangle();
    let s = scene;
    const segIds: string[] = [];
    for (const [a, b] of [[0, 1], [1, 2], [2, 0]] as const) {
      const op = addSegment(s, ids[a], ids[b]);
      s = op.scene;
      segIds.push(op.addedIds[0]);
    }
    // Incomplete picks must not close.
    expect(cycleFromSegments(s, segIds.slice(0, 2))).toBeNull();

    const cycle = cycleFromSegments(s, segIds);
    expect(cycle).not.toBeNull();
    expect(cycle!.boundary).toHaveLength(3);

    const op = addRegion(s, cycle!.boundary, { fill: "#3b82f6", opacity: 0.25 });
    const region = op.scene.objects.find((o) => o.type === "region") as GeoRegion;
    expect(region.boundary.slice().sort()).toEqual(ids.slice().sort());
  });

  it("rejects an open chain of lines", () => {
    const { scene, ids } = withPoints([[0, 0], [50, 0], [100, 0], [150, 0]]);
    let s = scene;
    const segIds: string[] = [];
    for (const [a, b] of [[0, 1], [1, 2], [2, 3]] as const) {
      const op = addSegment(s, ids[a], ids[b]);
      s = op.scene;
      segIds.push(op.addedIds[0]);
    }
    expect(cycleFromSegments(s, segIds)).toBeNull();
  });
});
