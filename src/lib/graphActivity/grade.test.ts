import { describe, expect, it } from "vitest";
import { checkGraph, POINT_TOLERANCE } from "./grade";
import { DEFAULT_GRAPH_TABLE } from "./table";
import { extractGraphTable } from "./table";

const table = DEFAULT_GRAPH_TABLE; // (−2,−1) … (2,7)

describe("checkGraph", () => {
  it("accepts exact table points joined by a straight line", () => {
    const result = checkGraph({ table, plotted: table, connect: "line" });
    expect(result.correctCount).toBe(5);
    expect(result.points.every((p) => p.status === "correct")).toBe(true);
    expect(result.connection.passed).toBe(true);
    expect(result.swappedAxes).toBe(false);
    expect(result.score.earned).toBe(6);
    expect(result.score.possible).toBe(6);
  });

  it("accepts a point just inside the 0.1 world-unit tolerance", () => {
    const plotted = table.map((p, i) => (i === 0 ? { x: p.x + 0.09, y: p.y } : p));
    const result = checkGraph({ table, plotted, connect: "scatter", tolerance: POINT_TOLERANCE });
    expect(result.points[0].status).toBe("correct");
    expect(result.correctCount).toBe(5);
  });

  it("rejects a point just outside the 0.1 world-unit tolerance", () => {
    const plotted = table.map((p, i) => (i === 0 ? { x: p.x + 0.11, y: p.y } : p));
    const result = checkGraph({ table, plotted, connect: "scatter" });
    expect(result.points[0].status).toBe("missed");
    expect(result.correctCount).toBe(4);
  });

  it("flags swapped axes and does not auto-mark them correct", () => {
    const plotted = table.map((p) => ({ x: p.y, y: p.x }));
    const result = checkGraph({ table, plotted, connect: "scatter" });
    expect(result.swappedAxes).toBe(true);
    expect(result.points.every((p) => p.status === "swapped")).toBe(true);
    expect(result.correctCount).toBe(0);
    expect(result.score.earned).toBe(0);
  });

  it("is independent of zoom and pan (view is ignored)", () => {
    const plotted = table;
    const close = checkGraph({ table, plotted, connect: "line", view: { cx: 0, cy: 0, scale: 40 } });
    const zoomed = checkGraph({ table, plotted, connect: "line", view: { cx: 12, cy: -8, scale: 400 } });
    expect(zoomed.score).toEqual(close.score);
    expect(zoomed.points.map((p) => p.status)).toEqual(close.points.map((p) => p.status));
    expect(zoomed.connection.passed).toBe(close.connection.passed);
    expect(zoomed.swappedAxes).toBe(close.swappedAxes);
  });
});

describe("extractGraphTable", () => {
  it("reads a graphTable on a board-like object", () => {
    expect(extractGraphTable({ graphTable: [{ x: 1, y: 2 }] })).toEqual([{ x: 1, y: 2 }]);
  });

  it("returns null when no x/y table is present", () => {
    expect(extractGraphTable({ columns: [{ title: "Q1", top: [] }] })).toBeNull();
  });
});
