// AREA-008 — deleting a filled region must remove only the region; the
// boundary segments and their points stay in the diagram.
import { describe, expect, it } from "vitest";
import { addPoint, addSegment, addRegion, eraseObject } from "@/lib/geometry/editor/sceneOps";
import type { GeometryScene } from "@/lib/geometry/scene";

const base = (): GeometryScene =>
  ({ objects: [], bounds: { width: 400, height: 300 } } as unknown as GeometryScene);

function triangleWithRegion() {
  let scene = base();
  const pts: string[] = [];
  for (const [x, y] of [[10, 10], [110, 10], [60, 110]] as Array<[number, number]>) {
    const op = addPoint(scene, x, y);
    scene = op.scene;
    pts.push(op.addedIds[0]);
  }
  const segs: string[] = [];
  for (const [a, b] of [[0, 1], [1, 2], [2, 0]] as Array<[number, number]>) {
    const op = addSegment(scene, pts[a], pts[b]);
    scene = op.scene;
    segs.push(...op.addedIds);
  }
  const rgn = addRegion(scene, pts, { fill: "#3b82f6", opacity: 0.35 });
  return { scene: rgn.scene, pts, segs, regionId: rgn.addedIds[0] };
}

describe("region deletion (AREA-008)", () => {
  it("removes the region", () => {
    const { scene, regionId } = triangleWithRegion();
    const after = eraseObject(scene, regionId).scene;
    expect(after.objects.some((o) => o.id === regionId)).toBe(false);
  });

  it("leaves every boundary segment and point behind", () => {
    const { scene, regionId, segs, pts } = triangleWithRegion();
    const after = eraseObject(scene, regionId).scene;
    for (const id of [...segs, ...pts]) {
      expect(after.objects.some((o) => o.id === id)).toBe(true);
    }
  });

  it("deleting a region does not delete other regions", () => {
    const { scene, pts, regionId } = triangleWithRegion();
    const second = addRegion(scene, [...pts].reverse(), { fill: "#ef4444", opacity: 0.2 });
    const after = eraseObject(second.scene, regionId).scene;
    expect(after.objects.some((o) => o.id === second.addedIds[0])).toBe(true);
  });
});
