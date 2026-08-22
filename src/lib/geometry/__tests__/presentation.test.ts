import { describe, expect, it } from "vitest";
import { splitPageGeometryScene } from "@/lib/geometry/presentation";
import type { GeometryScene } from "@/lib/geometry/scene";

describe("splitPageGeometryScene", () => {
  it("separates distant page drawings while retaining construction dependencies", () => {
    const scene: GeometryScene = {
      bounds: { width: 1200, height: 1200 },
      objects: [
        { id: "a", type: "point", x: 20, y: 1000 },
        { id: "b", type: "point", x: 200, y: 1100 },
        { id: "s", type: "segment", a: "a", b: "b" },
        { id: "c", type: "point", x: 40, y: 2000, hidden: true },
        { id: "r", type: "point", x: 100, y: 2000, hidden: true },
        { id: "circle", type: "circle", center: "c", rim: "r", r: 60 },
      ],
    };
    const groups = splitPageGeometryScene(scene);
    expect(groups).toHaveLength(2);
    expect(groups[0].objects.map((o) => o.id)).toEqual(expect.arrayContaining(["a", "b", "s"]));
    expect(groups[1].objects.map((o) => o.id)).toEqual(expect.arrayContaining(["c", "r", "circle"]));
  });
});