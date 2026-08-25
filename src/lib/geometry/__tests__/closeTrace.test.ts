import { describe, expect, it } from "vitest";
import { closeAreaTrace } from "@/lib/geometry/editor/closeTrace";
import { addPoint } from "@/lib/geometry/editor/sceneOps";
import type { GeometryScene } from "@/lib/geometry/scene";

const base = (): GeometryScene => ({ objects: [], bounds: { width: 400, height: 300 } } as unknown as GeometryScene);

function traced(count: number) {
  let scene = base();
  const ids: string[] = [];
  const pts: Array<[number, number]> = [[10, 10], [110, 10], [110, 110], [10, 110], [60, 160]];
  for (let i = 0; i < count; i++) {
    const op = addPoint(scene, pts[i][0], pts[i][1]);
    scene = op.scene;
    ids.push(op.addedIds[0]);
  }
  return { scene, ids };
}

describe("closeAreaTrace (AREA-005)", () => {
  it("carries the chosen fill and density in straight mode", () => {
    const { scene, ids } = traced(4);
    const out = closeAreaTrace(scene, ids, { curveMode: false, fill: "#ef4444", opacity: 0.6 });
    const rgn = out.scene.objects.find((o) => o.id === out.regionId) as any;
    expect(out.regionId).toBeTruthy();
    expect(rgn.fill).toBe("#ef4444");
    expect(rgn.opacity).toBe(0.6);
  });

  it("carries the chosen fill and density in curve mode too", () => {
    const { scene, ids } = traced(5);
    const out = closeAreaTrace(scene, ids, { curveMode: true, fill: "#22c55e", opacity: 0.4 });
    const rgn = out.scene.objects.find((o) => o.id === out.regionId) as any;
    expect(out.regionId).toBeTruthy();
    expect(rgn.fill).toBe("#22c55e");
    expect(rgn.opacity).toBe(0.4);
  });

  it("returns a selectable region id so the tool can finish with it selected", () => {
    const { scene, ids } = traced(4);
    const out = closeAreaTrace(scene, ids, { curveMode: false, fill: "#3b82f6", opacity: 0.25 });
    expect(out.ops.length).toBeGreaterThan(0);
    expect(out.scene.objects.some((o) => o.id === out.regionId)).toBe(true);
  });

  it("refuses to close fewer than three points and leaves the scene untouched", () => {
    const { scene, ids } = traced(2);
    const out = closeAreaTrace(scene, ids, { curveMode: false, fill: "#3b82f6", opacity: 0.25 });
    expect(out.regionId).toBeNull();
    expect(out.scene).toBe(scene);
    expect(out.ops).toHaveLength(0);
  });
});
