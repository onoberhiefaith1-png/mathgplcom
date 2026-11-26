import { describe, expect, it } from "vitest";
import type { GeometryScene, GeoPoint } from "@/lib/geometry/scene";
import { placeComputedDiagram } from "@/lib/lessonnotes/ai/aiEditDiagrams";

const QUESTION = `A ship leaves port A and travels 12 km on a bearing of 045° to point B. It then changes direction and travels 9 km on a bearing of 135° to point C. Calculate (a) the direct distance AC, (b) the bearing of C from A.`;

const POLLUTED = `${QUESTION}

Solution
CD = 15 km on 082°.
DE = 20 km on 315°.
EF = 15 km on 045°.
AC = 15 km.
Bearing of AC = 082°.`;

const point = (scene: GeometryScene, label: string) =>
  scene.objects.find((object) => object.type === "point" && object.label === label) as GeoPoint | undefined;

describe("the 12 km then 9 km bearings question", () => {
  it("keeps only A, B and C, fits them in the view, and caps the north lines", () => {
    const placed = placeComputedDiagram({
      source: POLLUTED,
      section: "solution",
      body: POLLUTED.split(/\n\s*Solution\b/i)[1] ?? "",
    });
    expect(placed?.valid).toBe(true);
    const scene = placed!.scene!;
    const labels = scene.objects
      .filter((object) => object.type === "point" && !object.hidden)
      .map((object) => (object.type === "point" ? object.label : ""));
    expect(labels.sort()).toEqual(["A", "B", "C"]);
    expect(scene.objects.some((object) => object.type === "point" && ["D", "E", "F"].includes(object.label ?? ""))).toBe(false);
    expect(placed?.text).not.toContain("CD =");
    expect(placed?.text).not.toContain("20 km");
    expect(placed?.text).not.toContain("315");
    expect(placed?.text).toContain("15 km");
    expect(placed?.text).toContain("082");

    const a = point(scene, "A")!;
    const b = point(scene, "B")!;
    const c = point(scene, "C")!;
    const n1 = point(scene, "N1")!;
    const n2 = point(scene, "N2")!;
    const width = scene.bounds.width;
    const height = scene.bounds.height;
    for (const mark of [a, b, c, n1, n2]) {
      expect(mark.x).toBeGreaterThanOrEqual(0);
      expect(mark.y).toBeGreaterThanOrEqual(0);
      expect(mark.x).toBeLessThanOrEqual(width);
      expect(mark.y).toBeLessThanOrEqual(height);
    }
    const figureH = Math.max(a.y, b.y, c.y) - Math.min(a.y, b.y, c.y);
    const northA = Math.hypot(n1.x - a.x, n1.y - a.y);
    const northB = Math.hypot(n2.x - b.x, n2.y - b.y);
    expect(northA).toBeLessThanOrEqual(figureH + 1);
    expect(northB).toBeLessThanOrEqual(figureH + 1);
    expect(northA).toBeGreaterThan(8);
    expect(scene.objects.filter((object) => object.type === "ray")).toHaveLength(0);

    const anchors = [a, b, c].map((mark) => ({
      x: mark.x + (mark.labelOffset?.dx ?? 0),
      y: mark.y + (mark.labelOffset?.dy ?? 0),
    }));
    for (let i = 0; i < anchors.length; i++) {
      for (let j = i + 1; j < anchors.length; j++) {
        const gap = Math.hypot(anchors[i].x - anchors[j].x, anchors[i].y - anchors[j].y);
        expect(gap).toBeGreaterThan(12);
      }
    }
    const span = Math.max(a.x, b.x, c.x) - Math.min(a.x, b.x, c.x);
    expect(span).toBeGreaterThan(width * 0.45);
  });
});
