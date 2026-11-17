import { describe, expect, it } from "vitest";
import { DEFAULT_GRAPH } from "./graphModel";
import {
  fitPoints, gridLines, majorStep, minorStepOf, panView, paperSize,
  snapWorld, toData, toPx, viewFromPaper, visibleBounds, zoomAt, zoomFactorFromWheel,
} from "./digitalView";

const paper = {
  unitsPerSquareX: DEFAULT_GRAPH.unitsPerSquareX,
  unitsPerSquareY: DEFAULT_GRAPH.unitsPerSquareY,
  squaresX: DEFAULT_GRAPH.squaresX,
  squaresY: DEFAULT_GRAPH.squaresY,
  originSquareX: DEFAULT_GRAPH.originSquareX,
  originSquareY: DEFAULT_GRAPH.originSquareY,
  viewZoom: 1,
};

describe("viewFromPaper — existing graphs still load in the same place", () => {
  it("maps the default paper graph so the origin sits at the paper origin", () => {
    const { w, h } = paperSize(paper);
    const view = viewFromPaper(paper, w, h);
    const origin = toPx({ x: 0, y: 0 }, view, w, h);
    // Default paper: origin at square (20, 8), 28 px per cm.
    expect(origin.x).toBeCloseTo(20 * 28, 6);
    expect(origin.y).toBeCloseTo(8 * 28, 6);
  });

  it("places a saved point (2, 3) where the old paper formula would", () => {
    const { w, h, sq } = paperSize(paper);
    const view = viewFromPaper(paper, w, h);
    const p = toPx({ x: 2, y: 3 }, view, w, h);
    const legacyX = paper.originSquareX * sq + (2 / paper.unitsPerSquareX) * sq;
    const legacyY = paper.originSquareY * sq - (3 / paper.unitsPerSquareY) * sq;
    expect(p.x).toBeCloseTo(legacyX, 6);
    expect(p.y).toBeCloseTo(legacyY, 6);
  });

  it("round-trips pixels back to world coordinates", () => {
    const { w, h } = paperSize(paper);
    const view = viewFromPaper(paper, w, h);
    const pix = toPx({ x: -4.5, y: 7.25 }, view, w, h);
    const back = toData(pix.x, pix.y, view, w, h);
    expect(back.x).toBeCloseTo(-4.5, 8);
    expect(back.y).toBeCloseTo(7.25, 8);
  });

  it("prefers a saved digital view when one is present", () => {
    const view = viewFromPaper({ ...paper, viewCx: 1, viewCy: 2, viewScaleX: 40, viewScaleY: 40 });
    expect(view).toEqual({ cx: 1, cy: 2, scaleX: 40, scaleY: 40 });
  });

  it("still loads a graph that only has the old paper fields", () => {
    const view = viewFromPaper({
      unitsPerSquareX: 2, unitsPerSquareY: 5,
      squaresX: 10, squaresY: 8, originSquareX: 3, originSquareY: 4, viewZoom: 1,
    });
    expect(view.scaleX).toBeCloseTo(28 / 2);
    expect(view.scaleY).toBeCloseTo(28 / 5);
    expect(Number.isFinite(view.cx)).toBe(true);
    expect(Number.isFinite(view.cy)).toBe(true);
  });
});

describe("zoom and grid step", () => {
  it("zooming in shrinks the visible window and the major step", () => {
    const { w, h } = paperSize(paper);
    const start = viewFromPaper(paper, w, h);
    const before = visibleBounds(start, w, h);
    const afterView = zoomAt(start, w, h, w / 2, h / 2, 2);
    const after = visibleBounds(afterView, w, h);
    expect(after.x1 - after.x0).toBeCloseTo((before.x1 - before.x0) / 2, 6);
    expect(majorStep(afterView, w, h).x).toBeLessThan(majorStep(start, w, h).x);
  });

  it("zooming out widens the visible window and the major step", () => {
    const { w, h } = paperSize(paper);
    const start = viewFromPaper(paper, w, h);
    const before = visibleBounds(start, w, h);
    const afterView = zoomAt(start, w, h, w / 2, h / 2, 0.5);
    const after = visibleBounds(afterView, w, h);
    expect(after.x1 - after.x0).toBeCloseTo((before.x1 - before.x0) * 2, 6);
    expect(majorStep(afterView, w, h).x).toBeGreaterThan(majorStep(start, w, h).x);
  });

  it("keeps the world point under the cursor still while zooming", () => {
    const { w, h } = paperSize(paper);
    const start = viewFromPaper(paper, w, h);
    const px = w * 0.7, py = h * 0.3;
    const world = toData(px, py, start, w, h);
    const zoomed = zoomAt(start, w, h, px, py, 1.6);
    const again = toData(px, py, zoomed, w, h);
    expect(again.x).toBeCloseTo(world.x, 8);
    expect(again.y).toBeCloseTo(world.y, 8);
  });

  it("uses a 1-2-5 major step with five minor steps", () => {
    const { w, h } = paperSize(paper);
    const view = viewFromPaper(paper, w, h);
    const major = majorStep(view, w, h);
    const mantissa = (s: number) => {
      const p = 10 ** Math.floor(Math.log10(s));
      return s / p;
    };
    expect([1, 2, 5, 10]).toContain(mantissa(major.x));
    expect(minorStepOf(major.x)).toBeCloseTo(major.x / 5);
    const { vertical } = gridLines(view, w, h);
    const majors = vertical.filter((l) => l.major);
    const minors = vertical.filter((l) => !l.major);
    expect(majors.length).toBeGreaterThan(2);
    expect(minors.length).toBeGreaterThan(majors.length);
  });

  it("snaps a world point to the current minor grid step", () => {
    const { w, h } = paperSize(paper);
    const view = viewFromPaper(paper, w, h);
    const step = minorStepOf(majorStep(view, w, h).x);
    const snapped = snapWorld(2.14, 3.01, view, w, h);
    expect(snapped.x / step).toBeCloseTo(Math.round(2.14 / step), 6);
    expect(Number.isFinite(snapped.y)).toBe(true);
  });

  it("panning shifts the window without changing the scale", () => {
    const { w, h } = paperSize(paper);
    const start = viewFromPaper(paper, w, h);
    const moved = panView(start, 28, 0);
    expect(moved.scaleX).toBe(start.scaleX);
    expect(moved.cx).toBeCloseTo(start.cx - 28 / start.scaleX, 8);
  });

  it("wheel zoom factor is greater than 1 when scrolling in (negative delta)", () => {
    expect(zoomFactorFromWheel(-100, 0)).toBeGreaterThan(1);
    expect(zoomFactorFromWheel(100, 0)).toBeLessThan(1);
  });
});

describe("fitPoints", () => {
  it("frames a table of points so all of them sit inside the view", () => {
    const pts = [{ x: -2, y: -1 }, { x: 0, y: 3 }, { x: 2, y: 7 }];
    const view = fitPoints(pts, 800, 600);
    const b = visibleBounds(view, 800, 600);
    for (const p of pts) {
      expect(p.x).toBeGreaterThan(b.x0);
      expect(p.x).toBeLessThan(b.x1);
      expect(p.y).toBeGreaterThan(b.y0);
      expect(p.y).toBeLessThan(b.y1);
    }
  });
});
