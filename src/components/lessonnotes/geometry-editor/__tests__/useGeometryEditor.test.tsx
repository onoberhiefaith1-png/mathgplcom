// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { act } from "react";
import { renderHook } from "@testing-library/react";
import { useGeometryEditor } from "../useGeometryEditor";
import { EMPTY_SCENE, type GeometryScene } from "@/lib/geometry/scene";
import { addPoint, addSegment, addCircleByRadius } from "@/lib/geometry/editor/sceneOps";

/**
 * The construction bugs were state-level: saving the scene echoed back through
 * the lesson note and wiped the pending click list, so circles never got a
 * second point and polylines never joined. These tests re-create that echo.
 */
function setup() {
  let latest: GeometryScene = EMPTY_SCENE;
  const hook = renderHook(
    ({ scene }: { scene: GeometryScene }) =>
      useGeometryEditor(scene, (s) => { latest = s; }),
    { initialProps: { scene: EMPTY_SCENE } },
  );
  return { hook, get: () => latest };
}

describe("useGeometryEditor construction survives the save echo", () => {
  it("keeps pending clicks when our own scene comes back in", () => {
    const { hook, get } = setup();
    act(() => {
      const op = addPoint(hook.result.current.scene, 10, 10);
      hook.result.current.apply(op);
      hook.result.current.setPendingIds([op.addedIds[0]]);
    });
    // The note re-serialises what we just saved.
    act(() => { hook.rerender({ scene: get() }); });
    expect(hook.result.current.pendingIds).toHaveLength(1);
  });

  it("builds a connected polyline across many clicks", () => {
    const { hook, get } = setup();
    let prev: string | null = null;
    for (let i = 0; i < 6; i++) {
      act(() => {
        const op = addPoint(hook.result.current.scene, i * 20, 40);
        const stored = hook.result.current.apply(op);
        const id = op.addedIds[0];
        if (prev) hook.result.current.apply(addSegment(stored, prev, id));
        prev = id;
        hook.result.current.setPendingIds([id]);
      });
      act(() => { hook.rerender({ scene: get() }); });
    }
    const segs = hook.result.current.scene.objects.filter((o) => o.type === "segment");
    expect(segs).toHaveLength(5);
  });

  it("creates a circle from centre + rim across two clicks", () => {
    const { hook, get } = setup();
    act(() => {
      const op = addPoint(hook.result.current.scene, 100, 100);
      hook.result.current.apply(op);
      hook.result.current.setPendingIds([op.addedIds[0]]);
    });
    act(() => { hook.rerender({ scene: get() }); });
    const centre = hook.result.current.pendingIds[0];
    expect(centre).toBeTruthy();
    act(() => {
      const op = addPoint(hook.result.current.scene, 140, 100);
      const stored = hook.result.current.apply(op);
      hook.result.current.apply(addCircleByRadius(stored, centre, op.addedIds[0]));
      hook.result.current.setPendingIds([]);
    });
    const circles = hook.result.current.scene.objects.filter((o) => o.type === "circle");
    expect(circles).toHaveLength(1);
    expect((circles[0] as any).r).toBeCloseTo(40, 3);
  });
});
