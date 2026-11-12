import { describe, expect, it } from "vitest";
import { fitColumnWeights, visibleMathLength } from "../tableColumnWeights";

// Lesson T1.1 (Game L8): no saved column widths, LaTeX headers.
const deviationTable = {
  cols: 3,
  headers: ["x", "x - \\bar{x}", "(x - \\bar{x})²"],
  cells: [["4", "-5", "25"], ["7", "-2", "4"], ["8", "-1", "1"], ["11", "2", "4"], ["15", "6", "36"]],
};
const share = (w: number[]) => w.map((v) => v / w.reduce((a, b) => a + b, 0));

describe("visible width of a maths header", () => {
  it("counts what is drawn, not the LaTeX source", () => {
    expect(visibleMathLength("x")).toBe(1);
    expect(visibleMathLength("x - \\bar{x}")).toBe(5);
    expect(visibleMathLength("(x - \\bar{x})²")).toBe(8);
    expect(visibleMathLength("(x - \\bar{x})^2")).toBeCloseTo(7.7);
    expect(visibleMathLength("\\frac{\\sum x}{N}")).toBe(3);
    expect(visibleMathLength("x̄")).toBe(1);
    expect(visibleMathLength("")).toBe(0);
  });
});

describe("Game table column widths", () => {
  it("gives the x column a fair share instead of a sliver (lesson T1.1)", () => {
    const w = fitColumnWeights(deviationTable, { textSize: 15, padX: 10 });
    const [x, dev, sq] = share(w);
    // Before: weights 72 : 198 : 252, so x had under 14% of the width.
    expect(x).toBeGreaterThanOrEqual(0.28);
    expect(dev).toBeCloseTo(x, 5); // x and x − x̄ both fit in the 72px floor: equal
    expect(sq).toBeGreaterThanOrEqual(x); // (x − x̄)² may be a little wider to stay on one line
    expect(sq).toBeLessThan(0.45);
  });
  it("keeps authored widths and the 72px floor, like Lesson Notes and Academia", () => {
    expect(fitColumnWeights({ cols: 3, headers: ["x", "x − μ", "(x − μ)²"], colWidths: [120, 240, 240] }, { textSize: 15, padX: 10 }))
      .toEqual([120, 240, 240]);
    expect(fitColumnWeights({ cols: 2, colWidths: [10, 0] }, { textSize: 15, padX: 10 })).toEqual([72, 72]);
  });
  it("widens a column only for a long visible header or cell", () => {
    const w = fitColumnWeights({ cols: 2, headers: ["f", "cumulative frequency"] }, { textSize: 15, padX: 10 });
    expect(w[0]).toBe(72);
    expect(w[1]).toBeGreaterThan(72 * 2);
  });
});
