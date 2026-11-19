import { describe, expect, it } from "vitest";
import { angleAtVertex } from "../editor/angleAtVertex";
import { snap } from "../editor/snap";
import type { GeoPoint, GeometryScene } from "../scene";

const point = (id: string, x: number, y: number): GeoPoint => ({
  id, type: "point", x, y, hidden: true, auto: true,
});
const triangle: GeometryScene = {
  bounds: { width: 200, height: 200 },
  objects: [
    point("a", 20, 120), point("b", 65, 35), point("c", 125, 120),
    { id: "ab", type: "segment", a: "a", b: "b" },
    { id: "bc", type: "segment", a: "b", b: "c" },
  ],
};

describe("diagram construction vertices", () => {
  it("reuses hidden endpoint identities when closing a triangle", () => {
    const closing = snap(triangle, 25, 119);
    expect(closing).toEqual({ x: 20, y: 120, pointId: "a" });
    const closed: GeometryScene = {
      ...triangle,
      objects: [...triangle.objects, { id: "ca", type: "segment", a: "c", b: closing.pointId! }],
    };
    expect(angleAtVertex(closed, "a", 20, 120)).toEqual({ vertex: "a", armA: "b", armB: "c" });
  });

  it("prefers an endpoint over a closer midpoint", () => {
    const short: GeometryScene = {
      ...triangle,
      objects: [
        point("a", 10, 10), point("b", 22, 10),
        { id: "ab", type: "segment", a: "a", b: "b" },
      ],
    };
    expect(snap(short, 15, 10).pointId).toBe("a");
  });

  it("finds the corner in older triangles with two nearly coincident endpoints", () => {
    const saved: GeometryScene = {
      ...triangle,
      objects: [...triangle.objects, point("a2", 23, 120), { id: "ca", type: "segment", a: "c", b: "a2" }],
    };
    expect(angleAtVertex(saved, "ab", 21, 119)).toEqual({ vertex: "a", armA: "b", armB: "c" });
    expect(angleAtVertex(triangle, "ab", 21, 119)).toBeNull();
  });
});
