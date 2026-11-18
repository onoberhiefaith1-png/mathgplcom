import { describe, expect, it } from "vitest";
import {
  DEFAULT_MARKS_PER_COORDINATE, DEFAULT_MAX_COORDINATES, DEFAULT_PLOT_COLOR, PLOT_COLORS, POINT_TOLERANCE,
  appendPlotPoint, columnHeadingLabel, commitPlotSeries, distanceToAnswerGraph, extractXY, flattenPlotPoints,
  applyTableGraphOptions, isGraphScoringActive, isOnAnswerGraph, normalizeExpectedLines, normalizeGraphAxes, normalizeGraphPlot,
  normalizeGraphScore, normalizePlotColor, parseTableNumber, plotSeriesOf, plotStroke, pointsAreLinear,
  scorePlotSeries, scoreTableGraph, screenDistToSeries, totalMarks, undoLastPlotPoint,
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
  it("defaults to 7 coordinates and 2 marks when nothing is stored, and stays off", () => {
    const s = normalizeGraphScore(undefined);
    expect(s).toMatchObject({
      enabled: false,
      maxCoordinates: DEFAULT_MAX_COORDINATES,
      marksPerCoordinate: DEFAULT_MARKS_PER_COORDINATE,
    });
    expect(s.maxCoordinates).toBe(7);
    expect(s.marksPerCoordinate).toBe(2);
    expect(s.maxPoints).toBe(14);
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

describe("plot colour", () => {
  it("defaults a saved plot with no colour to the current ink, and keeps a stored colour", () => {
    const legacy = normalizeGraphPlot({ xCol: 0, yCol: 1, points: [{ x: 1, y: 2 }], connect: "line" }, 3);
    expect(legacy?.color).toBe(DEFAULT_PLOT_COLOR);
    const saved = normalizeGraphPlot({ xCol: 0, yCol: 1, points: [{ x: 1, y: 2 }], connect: "line", color: "#2563eb" }, 3);
    expect(saved?.color).toBe("#2563EB");
  });

  it("accepts 3-digit hex, rejects invalid values, and exposes 6 to 8 palette colours starting with the default", () => {
    expect(normalizePlotColor("#abc")).toBe("#AABBCC");
    expect(normalizePlotColor("dc2626")).toBe("#DC2626");
    expect(normalizePlotColor("not-a-colour")).toBe(DEFAULT_PLOT_COLOR);
    expect(normalizePlotColor(undefined)).toBe(DEFAULT_PLOT_COLOR);
    expect(PLOT_COLORS.length).toBeGreaterThanOrEqual(6);
    expect(PLOT_COLORS.length).toBeLessThanOrEqual(8);
    expect(PLOT_COLORS[0]).toBe(DEFAULT_PLOT_COLOR);
  });

  it("paints the default ink with the theme colour, and other picks as themselves", () => {
    expect(plotStroke(undefined, "#FFFFFF")).toBe("#FFFFFF");
    expect(plotStroke(DEFAULT_PLOT_COLOR, "#FFFFFF")).toBe("#FFFFFF");
    expect(plotStroke("#DC2626", "#FFFFFF")).toBe("#DC2626");
  });

  it("does not change grading when two plots differ only in colour", () => {
    const expected = [{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }];
    const score = { enabled: true, maxCoordinates: 5, marksPerCoordinate: 2 };
    const plotted = [{ x: 4, y: 9 }, { x: 0, y: 0 }];
    const a = scoreTableGraph({ expected, plotted, score });
    const b = scoreTableGraph({ expected, plotted, score });
    const red = normalizeGraphPlot({ xCol: 0, yCol: 1, points: plotted, connect: "line", color: "#DC2626" }, 3);
    const blue = normalizeGraphPlot({ xCol: 0, yCol: 1, points: plotted, connect: "line", color: "#2563EB" }, 3);
    expect(red?.points).toEqual(blue?.points);
    expect(a).toEqual(b);
    expect(scoreTableGraph({ expected, plotted: red!.points, score })).toEqual(
      scoreTableGraph({ expected, plotted: blue!.points, score }),
    );
    expect(a.earned).toBe(2);
  });

  it("selects a line when the pointer is on the stroke or a point, including the edges of the hit band", () => {
    const pix = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    expect(screenDistToSeries(50, 0, pix, "line")).toBeCloseTo(0);
    expect(screenDistToSeries(50, 8, pix, "line")).toBeCloseTo(8);
    expect(screenDistToSeries(50, 8, pix, "line") <= 8).toBe(true);
    expect(screenDistToSeries(50, 8.02, pix, "line") <= 8).toBe(false);
    expect(screenDistToSeries(0, 0, pix, "none")).toBeCloseTo(0);
    // Scatter / points-only: mid-segment is not a hit if far from both points.
    expect(screenDistToSeries(50, 0, pix, "scatter")).toBeCloseTo(50);
  });
});

describe("separate plot series", () => {
  const red = "#DC2626";
  const blue = "#2563EB";
  const line = [{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }];
  const score = { enabled: true, maxCoordinates: 5, marksPerCoordinate: 2 };

  it("loads an older single-line plot as one series and keeps stored series separate", () => {
    const legacy = normalizeGraphPlot({ xCol: 0, yCol: 1, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], connect: "line" }, 3);
    expect(legacy?.series).toEqual([
      { points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], connect: "line", color: DEFAULT_PLOT_COLOR },
    ]);
    expect(plotSeriesOf({ points: legacy!.points, connect: "line", color: legacy!.color })).toHaveLength(1);

    const multi = normalizeGraphPlot({
      xCol: 0, yCol: 1,
      points: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 4, y: 0 }],
      connect: "line",
      color: red,
      series: [
        { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], connect: "line", color: red },
        { points: [{ x: 4, y: 0 }, { x: 5, y: 1 }], connect: "curve", color: blue },
      ],
    }, 3);
    expect(multi?.series).toHaveLength(2);
    expect(multi?.series?.[1]).toMatchObject({ connect: "curve", color: blue, points: [{ x: 4, y: 0 }, { x: 5, y: 1 }] });
    // Flattened top-level points come from the series, not a merged path.
    expect(multi?.points).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 4, y: 0 }, { x: 5, y: 1 }]);
    expect(flattenPlotPoints(multi!.series!)).toEqual(multi!.points);
  });

  it("connects new points to the current line in the order they were placed, not sorted by x", () => {
    let draft = appendPlotPoint({ series: [], startNew: true }, { x: 2, y: 1 }, "line", red);
    draft = appendPlotPoint(draft, { x: 0, y: 3 }, "line", red);
    draft = appendPlotPoint(draft, { x: 1, y: 2 }, "line", red);
    expect(draft.series).toHaveLength(1);
    expect(draft.series[0].points.map((p) => p.x)).toEqual([2, 0, 1]);
  });

  it("starts a new series after plotting is turned off and back on, and never joins the previous line", () => {
    let draft = appendPlotPoint({ series: [], startNew: true }, { x: 0, y: 1 }, "line", red);
    draft = appendPlotPoint(draft, { x: 1, y: 3 }, "line", red);
    draft = commitPlotSeries(draft);
    expect(draft.startNew).toBe(true);
    draft = appendPlotPoint(draft, { x: 4, y: 9 }, "line", blue);
    expect(draft.series).toHaveLength(2);
    expect(draft.series[0].points).toEqual([{ x: 0, y: 1 }, { x: 1, y: 3 }]);
    expect(draft.series[1].points).toEqual([{ x: 4, y: 9 }]);
    expect(draft.series[1].color).toBe(blue);
    // A later point still stays on the new line.
    draft = appendPlotPoint(draft, { x: 5, y: 11 }, "line", blue);
    expect(draft.series).toHaveLength(2);
    expect(draft.series[0].points).toHaveLength(2);
    expect(draft.series[1].points).toEqual([{ x: 4, y: 9 }, { x: 5, y: 11 }]);
    expect(undoLastPlotPoint(draft.series)[1].points).toEqual([{ x: 4, y: 9 }]);
  });

  it("scores each series' points against the expected line, with the existing duplicate handling and cap", () => {
    const series = [
      { points: [{ x: 0, y: 1 }, { x: 1, y: 3 }], connect: "line" as const, color: red },
      { points: [{ x: 1.05, y: 3.02 }, { x: 4, y: 9 }, { x: 5, y: 11 }, { x: 6, y: 13 }, { x: 7, y: 15 }, { x: 8, y: 17 }], connect: "line" as const, color: blue },
    ];
    const r = scorePlotSeries({ expected: line, series, score });
    // First series: two distinct correct points.
    expect(r.perPoint[0].correct).toBe(true);
    expect(r.perPoint[1].correct).toBe(true);
    // Second series starts with a near-duplicate of (1, 3).
    expect(r.perPoint[2].duplicate).toBe(true);
    expect(r.perPoint[2].awarded).toBe(0);
    // Cap is 5 distinct coordinates across all series: 2 + 4 scoring + 1 correct-but-capped.
    expect(r.correctCount).toBe(5);
    expect(r.earned).toBe(10);
    expect(r.perPoint[7].correct).toBe(true);
    expect(r.perPoint[7].awarded).toBe(0);
  });
});

describe("graph scoring activation and several expected lines", () => {
  const lineA = [{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }]; // y = 2x + 1
  const lineB = [{ x: 0, y: 0 }, { x: 2, y: 2 }]; // y = x
  const defaults = { enabled: true };
  const axes = { xCol: 0, yCol: 1 };

  it("uses the 2 × 7 default cap when the teacher has not set custom values", () => {
    const plotted = [
      { x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 7 },
      { x: 4, y: 9 }, { x: 5, y: 11 }, { x: 6, y: 13 }, { x: 7, y: 15 },
    ];
    const r = scoreTableGraph({ expected: lineA, plotted, score: defaults });
    expect(r.maxPoints).toBe(14);
    expect(r.correctCount).toBe(7);
    expect(r.earned).toBe(14);
    expect(r.perPoint[7].correct).toBe(true);
    expect(r.perPoint[7].awarded).toBe(0);
    expect(r.label).toBe("14 / 14");
  });

  it("treats a point as correct if it lies on any of several expected lines", () => {
    const r = scoreTableGraph({
      expected: lineA,
      expectedLines: [lineB],
      plotted: [{ x: 10, y: 21 }, { x: 4, y: 4 }, { x: 1, y: 0 }],
      score: { enabled: true, maxCoordinates: 7, marksPerCoordinate: 2 },
    });
    expect(r.perPoint[0].correct).toBe(true); // on line A
    expect(r.perPoint[1].correct).toBe(true); // on line B
    expect(r.perPoint[2].correct).toBe(false);
    expect(r.earned).toBe(4);
    expect(normalizeExpectedLines([lineB, { points: lineA }])).toHaveLength(2);
  });

  it("awards no marks and reports no score when the graph is not enabled or the axes are not defined", () => {
    const plotted = [{ x: 0, y: 1 }, { x: 4, y: 9 }];
    const off = scoreTableGraph({ expected: lineA, plotted, score: { enabled: false, maxCoordinates: 7, marksPerCoordinate: 2 } });
    expect(off.earned).toBe(0);
    expect(off.maxPoints).toBe(0);
    expect(off.label).toBe("0 / 0");
    expect(off.perPoint[0].correct).toBe(true);
    expect(off.perPoint[0].awarded).toBe(0);

    const noAxes = scoreTableGraph({
      expected: lineA, plotted, score: defaults, axes: undefined, cols: 3,
    });
    expect(isGraphScoringActive(defaults, undefined, 3)).toBe(false);
    expect(isGraphScoringActive({ enabled: false, maxCoordinates: 7, marksPerCoordinate: 2 }, axes, 3)).toBe(false);
    expect(isGraphScoringActive(defaults, axes, 3)).toBe(true);
    expect(noAxes.earned).toBe(0);
    expect(noAxes.maxPoints).toBe(0);
    expect(noAxes.label).toBe("0 / 0");
  });
});


describe("applyTableGraphOptions", () => {
  const grid = {
    objId: "t1",
    label: "Values",
    headers: ["x", "y"],
    cells: [["0", "1"], ["1", "3"], ["2", "5"]],
    rows: 3,
    cols: 2,
  };

  it("defaults Add graph to 7 coordinates and 2 marks when enabling with no saved values", () => {
    const next = applyTableGraphOptions(grid, { enabled: true });
    expect(next.graphScore).toMatchObject({
      enabled: true,
      maxCoordinates: DEFAULT_MAX_COORDINATES,
      marksPerCoordinate: DEFAULT_MARKS_PER_COORDINATE,
    });
    expect(next.graphScore.maxPoints).toBe(14);
    expect(next.graphAxes).toBeUndefined();
    expect(isGraphScoringActive(next.graphScore, next.graphAxes, next.cols)).toBe(false);
  });

  it("keeps overlay axes and marks the graph active so grading can run", () => {
    const fromOverlay = { ...grid, graphAxes: { xCol: 0, yCol: 1 } };
    const next = applyTableGraphOptions(fromOverlay, { enabled: true });
    expect(next.graphAxes).toEqual({ xCol: 0, yCol: 1 });
    expect(isGraphScoringActive(next.graphScore, next.graphAxes, next.cols)).toBe(true);
    const scored = scoreTableGraph({
      expected: [{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }],
      plotted: [{ x: 0, y: 1 }, { x: 1, y: 3 }],
      score: next.graphScore,
      axes: next.graphAxes,
      cols: next.cols,
    });
    expect(scored.maxPoints).toBe(14);
    expect(scored.earned).toBe(4);
  });

  it("saves axes chosen on the generate-page picker when the overlay had none", () => {
    const next = applyTableGraphOptions(grid, { enabled: true, maxCoordinates: 7, marksPerCoordinate: 2 }, { xCol: 0, yCol: 1 });
    expect(next.graphAxes).toEqual({ xCol: 0, yCol: 1 });
    expect(isGraphScoringActive(next.graphScore, next.graphAxes, next.cols)).toBe(true);
  });
});
