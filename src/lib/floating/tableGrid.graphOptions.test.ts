import { describe, expect, it } from "vitest";
import { generateTableLines, gridFromObject } from "./tableGrid";
import type { SolutionObject } from "./solutionItems";
import {
  applyTableGraphOptions,
  isGraphScoringActive,
  normalizeGraphScore,
  scoreTableGraph,
} from "@/lib/lessonnotes/tableGraph";

const tableObject = (attrs: Record<string, unknown>): SolutionObject => ({
  objId: "table#1",
  nodeType: "table",
  family: "table",
  label: "Values",
  attrs,
  afterLine: 0,
});

describe("highlight → graph overlay → generate path", () => {
  it("keeps axes saved in the SmartTable overlay on the generated table grid", () => {
    const grid = gridFromObject(tableObject({
      headers: ["x", "y"],
      cells: [["0", "1"], ["1", "3"], ["2", "5"]],
      rows: 3,
      cols: 2,
      // Axes chosen on the lesson-notes Graph overlay before highlight.
      graphAxes: { xCol: 0, yCol: 1 },
    }));
    expect(grid).toBeTruthy();
    expect(grid!.graphAxes).toEqual({ xCol: 0, yCol: 1 });

    const scored = applyTableGraphOptions(grid!, normalizeGraphScore({ enabled: true }));
    expect(scored.graphScore).toMatchObject({
      enabled: true,
      maxCoordinates: 7,
      marksPerCoordinate: 2,
    });
    expect(isGraphScoringActive(scored.graphScore, scored.graphAxes, scored.cols)).toBe(true);

    const lines = generateTableLines(scored, "row");
    expect(lines.length).toBeGreaterThan(0);
    // The generate page stamps this same scored grid onto every floating line.
    const result = scoreTableGraph({
      expected: [{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }],
      plotted: [{ x: 0, y: 1 }],
      score: scored.graphScore,
      axes: scored.graphAxes,
      cols: scored.cols,
    });
    expect(result.maxPoints).toBe(14);
    expect(result.earned).toBe(2);
  });

  it("stores axes chosen only on the generate-page picker so grading can run", () => {
    const grid = gridFromObject(tableObject({
      headers: ["x", "y"],
      cells: [["0", "1"], ["1", "3"]],
      rows: 2,
      cols: 2,
    }));
    expect(grid!.graphAxes).toBeUndefined();
    const scored = applyTableGraphOptions(
      grid!,
      { enabled: true, maxCoordinates: 7, marksPerCoordinate: 2 },
      { xCol: 0, yCol: 1 },
    );
    expect(scored.graphAxes).toEqual({ xCol: 0, yCol: 1 });
    expect(isGraphScoringActive(scored.graphScore, scored.graphAxes, scored.cols)).toBe(true);
  });
});
