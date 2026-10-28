import { describe, expect, it } from "vitest";
import {
  containTextInSurface,
  surfaceInnerBox,
  textInsideSurface,
} from "../layout";

const inner = surfaceInnerBox(3, 1.2, 0.2);

const move = (body: { left: number; right: number; top: number; bottom: number }) => {
  const { dx, dy } = containTextInSurface(body, inner);
  return {
    left: body.left + dx,
    right: body.right + dx,
    top: body.top + dy,
    bottom: body.bottom + dy,
  };
};

describe("text in surface", () => {
  it("leaves a contained body exactly where the teacher placed it", () => {
    const body = { left: -1, right: 1, top: 0.3, bottom: -0.3 };
    expect(textInsideSurface(body, inner)).toBe(true);
    expect(containTextInSurface(body, inner)).toEqual({ dx: 0, dy: 0, fits: true });
  });

  it("pulls a body that starts left of the surface back inside", () => {
    const body = { left: -4, right: -2, top: 0.2, bottom: -0.2 };
    expect(textInsideSurface(body, inner)).toBe(false);
    expect(textInsideSurface(move(body), inner)).toBe(true);
  });

  it("pulls a body that runs past the right edge back inside", () => {
    expect(textInsideSurface(move({ left: 1, right: 2.6, top: 0.2, bottom: -0.2 }), inner)).toBe(true);
  });

  it("corrects vertical escape above and below the surface", () => {
    expect(textInsideSurface(move({ left: -1, right: 1, top: 2, bottom: 1.4 }), inner)).toBe(true);
    expect(textInsideSurface(move({ left: -1, right: 1, top: -1.4, bottom: -2 }), inner)).toBe(true);
  });

  it("anchors an oversized body at the surface edge instead of leaving it adrift", () => {
    const result = containTextInSurface({ left: -9, right: 9, top: 0.2, bottom: -0.2 }, inner);
    expect(result.fits).toBe(false);
    expect(-9 + result.dx).toBeCloseTo(inner.left, 5);
  });
});
