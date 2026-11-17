import { describe, expect, it } from "vitest";
import {
  extractXY, normalizeGraphPlot, normalizeGraphScore, parseTableNumber, scoreTableGraph,
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

describe("normalizeGraphScore", () => {
  it("defaults to 1 mark per row and a max equal to the sum", () => {
    expect(normalizeGraphScore(undefined, 3)).toEqual({ maxPoints: 3, rowMarks: [1, 1, 1] });
  });

  it("keeps teacher-set marks and a max cap, padding extra rows with 1", () => {
    expect(normalizeGraphScore({ maxPoints: 10, rowMarks: [2, 3] }, 4))
      .toEqual({ maxPoints: 10, rowMarks: [2, 3, 1, 1] });
  });

  it("truncates marks when the table shrinks and floors a negative max at 0", () => {
    expect(normalizeGraphScore({ maxPoints: -4, rowMarks: [2, 2, 2] }, 2))
      .toEqual({ maxPoints: 0, rowMarks: [2, 2] });
  });

  it("survives being stored and read back as table JSON", () => {
    const stored = JSON.parse(JSON.stringify({ graphScore: { maxPoints: 8, rowMarks: [2, 2, 4] } }));
    expect(normalizeGraphScore(stored.graphScore, 3)).toEqual({ maxPoints: 8, rowMarks: [2, 2, 4] });
  });
});

describe("extractXY", () => {
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
});

describe("normalizeGraphPlot", () => {
  it("keeps a saved student plot and drops a plot with a bad column", () => {
    const ok = normalizeGraphPlot({ xCol: 0, yCol: 1, points: [{ x: 1, y: 2 }], connect: "line" }, 3);
    expect(ok).toEqual({ xCol: 0, yCol: 1, points: [{ x: 1, y: 2 }], connect: "line" });
    expect(normalizeGraphPlot({ xCol: 0, yCol: 4, points: [] }, 3)).toBeUndefined();
  });
});

describe("scoreTableGraph — teacher marks, capped at max", () => {
  const expected = [
    { x: 0, y: 1, row: 0 },
    { x: 1, y: 3, row: 1 },
    { x: 2, y: 5, row: 2 },
  ];
  const score = { maxPoints: 10, rowMarks: [2, 3, 5] };

  it("awards each correct point its teacher-set mark", () => {
    const r = scoreTableGraph({ expected, plotted: expected, score });
    expect(r.perPoint.map((p) => p.awarded)).toEqual([2, 3, 5]);
    expect(r.uncapped).toBe(10);
    expect(r.earned).toBe(10);
    expect(r.label).toBe("10 / 10");
  });

  it("gives no marks for a missed point or a swapped-axis plot", () => {
    const missed = scoreTableGraph({
      expected,
      plotted: [expected[0], expected[1], { x: 9, y: 9 }],
      score,
    });
    expect(missed.perPoint[2].correct).toBe(false);
    expect(missed.earned).toBe(5);

    const swapped = scoreTableGraph({
      expected,
      plotted: expected.map((p) => ({ x: p.y, y: p.x })),
      score,
    });
    expect(swapped.grade.swappedAxes).toBe(true);
    expect(swapped.earned).toBe(0);
  });

  it("caps the total at maxPoints even when the marks add up to more", () => {
    const r = scoreTableGraph({
      expected,
      plotted: expected,
      score: { maxPoints: 6, rowMarks: [2, 3, 5] },
    });
    expect(r.uncapped).toBe(10);
    expect(r.earned).toBe(6);
    expect(r.label).toBe("6 / 6");
  });

  it("accepts a point just inside the 0.1 world-unit tolerance", () => {
    const plotted = [{ x: 0.09, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }];
    const r = scoreTableGraph({ expected, plotted, score });
    expect(r.perPoint[0].correct).toBe(true);
    expect(r.earned).toBe(10);
  });

  it("rejects a point just outside the 0.1 world-unit tolerance", () => {
    const plotted = [{ x: 0.11, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }];
    const r = scoreTableGraph({ expected, plotted, score });
    expect(r.perPoint[0].correct).toBe(false);
    expect(r.earned).toBe(8);
  });

  it("uses the mark for the original table row when a middle row is skipped", () => {
    const sparse = [
      { x: 0, y: 1, row: 0 },
      { x: 2, y: 5, row: 2 },
    ];
    const r = scoreTableGraph({
      expected: sparse,
      plotted: sparse,
      score: { maxPoints: 20, rowMarks: [2, 99, 5] },
    });
    expect(r.perPoint.map((p) => p.awarded)).toEqual([2, 5]);
    expect(r.earned).toBe(7);
  });
});
