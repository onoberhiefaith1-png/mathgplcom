import { describe, expect, it } from "vitest";
import { parseEquation } from "../math";
import { boundsFor, clampScale, fitBounds, modeFor } from "../framing";

describe("Math Lab phase two", () => {
  it("recognises a circle as an implicit 2D shape", () => {
    const eq = parseEquation("x^2 + y^2 = 9");
    expect(eq.kind).toBe("implicit2d"); expect(modeFor(eq)).toBe("2D");
    if (eq.kind !== "implicit2d") throw Error("Expected circle");
    expect(eq.f({ x: 3, y: 0 })).toBe(0);
  });
  it("recognises 2D versus 3D parametric curves", () => {
    expect(modeFor(parseEquation("x = cos(t); y = sin(t)"))).toBe("2D");
    expect(modeFor(parseEquation("x = cos(t); y = sin(t); z = t"))).toBe("3D");
  });
  it("frames shifted parabola vertex and both roots", () => {
    const b = boundsFor(parseEquation("y = (x - 20)^2 - 4"));
    expect(b.xmin).toBeLessThan(18); expect(b.xmax).toBeGreaterThan(22);
    expect(b.ymin).toBeLessThan(-4); expect(b.ymax).toBeGreaterThan(0);
  });
  it("fits equally scaled axes inside the available canvas", () => {
    const b = boundsFor(parseEquation("y = (x - 20)^2 - 4"));
    const v = fitBounds(b, 800, 500);
    expect(v.cx).toBeCloseTo(20);
    expect((b.xmax - b.xmin) * v.scale).toBeLessThanOrEqual(752);
    expect((b.ymax - b.ymin) * v.scale).toBeLessThanOrEqual(452);
  });
  it("bounds zoom between 2 and 5000 pixels per unit", () => {
    expect(clampScale(0.01)).toBe(2); expect(clampScale(9000)).toBe(5000);
  });
  it("rejects incomplete and unknown-symbol equations", () => {
    for (const source of ["", "y =", "y = banana(x)", "y = q + x"]) expect(parseEquation(source).kind).toBe("error");
  });
  it("frames a point outside the original window", () => {
    const v = fitBounds(boundsFor(parseEquation("(100, 80)")), 800, 500);
    expect(v.cx).toBe(100); expect(v.cy).toBe(80);
  });
});