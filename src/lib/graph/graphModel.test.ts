import { describe, expect, it } from "vitest";
import { DEFAULT_GRAPH, sanitizeGraphAttrs } from "./graphModel";
import { toPx, viewFromPaper, paperSize } from "./digitalView";

describe("sanitizeGraphAttrs — digital view fields", () => {
  it("loads an older paper-only graph without inventing a digital view", () => {
    const a = sanitizeGraphAttrs({
      unitsPerSquareX: 1,
      unitsPerSquareY: 1,
      squaresX: 40,
      squaresY: 16,
      originSquareX: 20,
      originSquareY: 8,
      points: [{ x: 2, y: 3 }],
      viewZoom: 1,
    });
    expect(a.viewCx).toBeNull();
    expect(a.viewCy).toBeNull();
    expect(a.viewScaleX).toBeNull();
    expect(a.viewScaleY).toBeNull();
    expect(a.points).toEqual([{ x: 2, y: 3 }]);
    const { w, h } = paperSize(a);
    const view = viewFromPaper(a, w, h);
    const p = toPx({ x: 2, y: 3 }, view, w, h);
    expect(p.x).toBeCloseTo(20 * 28 + 2 * 28, 6);
    expect(p.y).toBeCloseTo(8 * 28 - 3 * 28, 6);
  });

  it("keeps a saved digital view", () => {
    const a = sanitizeGraphAttrs({
      ...DEFAULT_GRAPH,
      viewCx: 3.5,
      viewCy: -1,
      viewScaleX: 56,
      viewScaleY: 56,
    });
    expect(a.viewCx).toBe(3.5);
    expect(a.viewCy).toBe(-1);
    expect(a.viewScaleX).toBe(56);
    expect(a.viewScaleY).toBe(56);
  });

  it("treats non-numeric view fields as unset", () => {
    const a = sanitizeGraphAttrs({ viewCx: "1", viewCy: undefined, viewScaleX: NaN, viewScaleY: Infinity });
    expect(a.viewCx).toBeNull();
    expect(a.viewCy).toBeNull();
    expect(a.viewScaleX).toBeNull();
    expect(a.viewScaleY).toBeNull();
  });
});
