import { describe, expect, it } from "vitest";
import {
  POINT_TOLERANCE, columnHeadingLabel, distanceToAnswerGraph, extractXY,
  isOnAnswerGraph, normalizeGraphAxes, normalizeGraphPlot, normalizeGraphScore,
  parseTableNumber, pointsAreLinear, scoreTableGraph, totalMarks,
} from "./tableGraph";

describe("parseTableNumber", () => {
  it("reads plain, signed, comma and unicode-minus values", () => {
    expect(parseTableNumber("2")).toBe(2);
    expect(parseTableNumber("−3.5")).toBe(-3.5);
    expect(parseTableNumber("1,000")).toBe(1000);
    expect(parseTableNumber("= 4")).toBe(4);
    expect(parseTableNumber("$1.25$")).toBe(1.25);
    expect(parseTableNumber("")).toBeNull();
    expect(parseTableNumber("x")).toBeNull();
  });
});

describe("columnHeadingLabel", () => {
  it("shows plain headings exactly and falls back when empty", () => {
    expect(columnHeadingLabel("x", 0)).toBe("x");
    expect(columnHeadingLabel("", 2)).toBe("Column 3");
    expect(columnHeadingLabel(null, 0)).toBe("Column 1");
  });

  it("converts math headings such as x − μ and (x − μ)² into readable text", () => {
    expect(columnHeadingLabel("x-\\mu", 1)).toBe("x−μ");
    expect(columnHeadingLabel("(x-\\mu)^2", 2)).toBe("(x−μ)²");
    expect(columnHeadingLabel("x − \\mu", 1)).toMatch(/x\s*−\s*μ/);
  });
});

describe("normalizeGraphScore", () => {
  it("defaults to 5 coordinates and 1 mark when nothing is stored, and stays off", () => {
    const s = normalizeGraphScore(undefined);
    expect(s).toMatchObject({ enabled: false, maxCoordinates: 5, marksPerCoordinate: 1 });
    expect(s.maxPoints).toBe(5);
  });

  it("keeps teacher-set max coordinates and marks per coordinate", () => {
    expect(normalizeGraphScore({ enabled: true, maxCoordinates: 5, marksPerCoordinate: 2 }))
      .toMatchObject({ enabled: true, maxCoordinates: 5, marksPerCoordinate: 2, maxPoints: 10 });
  });

  it("loads older maxPoints/rowMarks data as coordinates × marks", () => {
    const s = normalizeGraphScore({ maxPoints: 10, rowMarks: [2, 2, 2, 2, 2] }, 5);
    expect(s.enabled).toBe(true);
    expect(s.marksPerCoordinate).toBe(2);
    expect(s.maxCoordinates).toBe(5);
    expect(totalMarks(s)).toBe(10);
  });

  it("survives being stored and read back as table JSON", () => {
    const stored = JSON.parse(JSON.stringify({
      graphScore: { enabled: true, maxCoordinates: 5, marksPerCoordinate: 2 },
    }));
    expect(normalizeGraphScore(stored.graphScore)).toMatchObject({
      enabled: true, maxCoordinates: 5, marksPerCoordinate: 2, maxPoints: 10,
    });
  });
});

describe("extractXY / axes / plot", () => {
  it("pairs two columns and skips rows that are not both numeric", () => {
    const cells = [
      ["1", "2", "a"],
      ["3", "x", "4"],
      ["5", "6", "7"],
    ];
    expect(extractXY(cells, 0, 1)).toEqual([
      { x: 1, y: 2, row: 0 },
      { x: 5, y: 6, row: 2 },
    ]);
  });

  it("keeps a saved student plot and a teacher axis pair, and drops a bad column", () => {
    const ok = normalizeGraphPlot({ xCol: 0, yCol: 1, points: [{ x: 1, y: 2 }], connect: "line", earned: 6, maxPoints: 10 }, 3);
    expect(ok).toMatchObject({ xCol: 0, yCol: 1, points: [{ x: 1, y: 2 }], connect: "line", earned: 6, maxPoints: 10 });
    expect(normalizeGraphPlot({ xCol: 0, yCol: 4, points: [] }, 3)).toBeUndefined();
    expect(normalizeGraphAxes({ xCol: 0, yCol: 1 }, 3)).toEqual({ xCol: 0, yCol: 1 });
    expect(normalizeGraphAxes({ xCol: 0, yCol: 0 }, 3)).toBeUndefined();
  });
});

describe("answer graph geometry", () => {
  const line = [{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }]; // y = 2x + 1

  it("treats colinear table points as a single infinite line", () => {
    expect(pointsAreLinear(line)).toBe(true);
    // Far past the data, still on the line: x = 10, y = 21
    expect(isOnAnswerGraph({ x: 10, y: 21 }, line)).toBe(true);
    expect(isOnAnswerGraph({ x: -4, y: -7 }, line)).toBe(true);
    // Perpendicular distance to y=2x+1 is |dy| / √5, so 0.20 in y is still inside 0.1.
    expect(distanceToAnswerGraph({ x: 0, y: 1.2 }, line)).toBeLessThanOrEqual(POINT_TOLERANCE);
    expect(isOnAnswerGraph({ x: 0, y: 1.25 }, line)).toBe(false);
  });

  it("uses piecewise-linear interpolation with end extension for a squared column", () => {
    const curve = [
      { x: -2, y: 4 },
      { x: -1, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 4 },
    ];
    expect(pointsAreLinear(curve)).toBe(false);
    // Mid-segment: between (0,0) and (1,1)
    expect(isOnAnswerGraph({ x: 0.5, y: 0.5 }, curve)).toBe(true);
    // Off the polyline
    expect(isOnAnswerGraph({ x: 0.5, y: 0.25 }, curve)).toBe(false);
    // Linear extension past x = 2 along the last segment (1,1)→(2,4): slope 3, so x=3, y=7
    expect(isOnAnswerGraph({ x: 3, y: 7 }, curve)).toBe(true);
    // The true parabola y=x² would be 9 here — that point is not on the extension
    expect(isOnAnswerGraph({ x: 3, y: 9 }, curve)).toBe(false);
  });
});

describe("scoreTableGraph — on the line, cap, duplicates", () => {
  const expected = [
    { x: 0, y: 1, row: 0 },
    { x: 1, y: 3, row: 1 },
    { x: 2, y: 5, row: 2 },
  ];
  const score = { enabled: true, maxCoordinates: 5, marksPerCoordinate: 2 };

  it("awards marksPerCoordinate for a click on the infinite line, not only a table row", () => {
    const r = scoreTableGraph({ expected, plotted: [{ x: 10, y: 21 }], score });
    expect(r.perPoint[0].correct).toBe(true);
    expect(r.earned).toBe(2);
    expect(r.label).toBe("2 / 10");
  });

  it("gives no marks for a click off the line", () => {
    const r = scoreTableGraph({ expected, plotted: [{ x: 1, y: 0 }], score });
    expect(r.perPoint[0].correct).toBe(false);
    expect(r.earned).toBe(0);
  });

  it("caps the total at maxCoordinates × marksPerCoordinate, even if more correct clicks are made", () => {
    const plotted = [
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
      { x: 4, y: 9 },
      { x: 5, y: 11 },
    ];
    const r = scoreTableGraph({ expected, plotted, score });
    expect(r.correctCount).toBe(5);
    expect(r.earned).toBe(10);
    expect(r.uncapped).toBe(12);
    expect(r.perPoint[5].correct).toBe(true);
    expect(r.perPoint[5].awarded).toBe(0);
    expect(r.label).toBe("10 / 10");
  });

  it("does not count a near-duplicate click twice", () => {
    const r = scoreTableGraph({
      expected,
      plotted: [{ x: 1, y: 3 }, { x: 1.05, y: 3.02 }],
      score,
    });
    expect(r.perPoint[0].correct).toBe(true);
    expect(r.perPoint[1].duplicate).toBe(true);
    expect(r.perPoint[1].awarded).toBe(0);
    expect(r.earned).toBe(2);
  });

  it("accepts a point just inside the 0.1 tolerance and rejects one just outside", () => {
    const inside = scoreTableGraph({ expected, plotted: [{ x: 0, y: 1.2 }], score });
    expect(inside.perPoint[0].correct).toBe(true);
    const outside = scoreTableGraph({ expected, plotted: [{ x: 0, y: 1.25 }], score });
    expect(outside.perPoint[0].correct).toBe(false);
  });

  it("still scores older saved maxPoints/rowMarks tables under the new rule", () => {
    const r = scoreTableGraph({
      expected,
      plotted: [{ x: 4, y: 9 }, { x: 5, y: 11 }],
      score: { maxPoints: 10, rowMarks: [2, 2, 2, 2, 2] },
    });
    expect(r.earned).toBe(4);
    expect(r.maxPoints).toBe(10);
  });

  it("awards no marks when Add graph is off, even if the clicks lie on the line", () => {
    const r = scoreTableGraph({
      expected,
      plotted: [{ x: 4, y: 9 }, { x: 0, y: 1 }],
      score: { enabled: false, maxCoordinates: 5, marksPerCoordinate: 2 },
    });
    expect(r.earned).toBe(0);
    expect(r.maxPoints).toBe(0);
    expect(r.perPoint[0].correct).toBe(true);
    expect(r.perPoint[0].awarded).toBe(0);
  });
});
