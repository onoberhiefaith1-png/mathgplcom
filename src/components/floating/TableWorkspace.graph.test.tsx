import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupDom } from "@/test/domRender";
import TableWorkspace from "./TableWorkspace";
import type { TableGrid } from "@/lib/floating/tableGrid";
import { normalizeGraphScore, type GraphAxes, type GraphScore } from "@/lib/lessonnotes/tableGraph";

vi.mock("@/components/structures/StructureStage", () => ({
  StructureStage: () => null,
  canRenderStructure: () => false,
}));
vi.mock("@/lib/notebook/mathRender", () => ({
  renderMathInline: (s: string) => s,
}));
vi.mock("@/components/lessonnotes/SolutionObjectView", () => ({
  SolutionObjectView: () => null,
}));

const grid: TableGrid = {
  objId: "t1",
  label: "Values",
  headers: ["x", "y"],
  cells: [["0", "1"], ["1", "3"], ["2", "5"]],
  rows: 3,
  cols: 2,
};

describe("TableWorkspace generate-page graph options", () => {
  let dom: ReturnType<typeof setupDom>;
  afterEach(async () => { await dom?.cleanup(); });

  const render = async (extra: Partial<Parameters<typeof TableWorkspace>[0]> = {}) => {
    dom = setupDom();
    const score = extra.graphScore ?? normalizeGraphScore(undefined, grid.rows);
    await dom.render(
      <TableWorkspace
        grid={grid}
        orientation="row"
        retained={[]}
        retentionMode={false}
        activeCells={[]}
        manualActive={false}
        lineCount={0}
        onOrientationChange={() => {}}
        onGenerate={() => {}}
        onToggleRetention={() => {}}
        onAddLine={() => {}}
        onCellClick={() => {}}
        graphScore={score}
        onGraphScoreChange={() => {}}
        onGraphAxesChange={() => {}}
        {...extra}
      />,
    );
  };

  it("shows Row, Column, Subcell, Retention and Add graph in the same options group", async () => {
    await render();
    const group = document.querySelector("[data-table-options]") as HTMLElement;
    expect(group).toBeTruthy();
    expect(group.querySelector("[data-orientation='row']")?.textContent).toContain("Row");
    expect(group.querySelector("[data-orientation='column']")?.textContent).toContain("Column");
    expect(group.querySelector("[data-orientation='subcell']")?.textContent).toContain("Subcell");
    expect(group.querySelector("[data-retention-toggle]")?.textContent).toContain("Retention");
    expect(group.querySelector("[data-add-graph-toggle]")).toBeTruthy();
    expect(group.textContent).toContain("Add graph");
    expect(group.querySelector("[data-axis-picker]")).toBeNull();
  });

  it("enabling Add graph activates the graph with 7 coordinates and 2 marks each", async () => {
    const seen: GraphScore[] = [];
    await render({
      graphScore: normalizeGraphScore(undefined),
      onGraphScoreChange: (s) => { seen.push(s); },
    });
    const toggle = document.querySelector("[data-add-graph-toggle]") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    await act(async () => { toggle.click(); });
    expect(seen.at(-1)).toMatchObject({
      enabled: true,
      maxCoordinates: 7,
      marksPerCoordinate: 2,
    });
  });

  it("labels Add graph fields Number of coordinates and Max marks per coordinate, defaulting to 7 and 2", async () => {
    await render({
      graphScore: normalizeGraphScore({ enabled: true }),
    });
    const coords = document.querySelector("[data-max-coordinates]") as HTMLInputElement;
    const marks = document.querySelector("[data-marks-per-coordinate]") as HTMLInputElement;
    expect(coords.value).toBe("7");
    expect(marks.value).toBe("2");
    const panel = document.querySelector("[data-add-graph-panel]") as HTMLElement;
    expect(panel.textContent).toContain("Number of coordinates");
    expect(panel.textContent).toContain("Max marks per coordinate");
    expect(panel.textContent).not.toContain("Maximum coordinates");
  });

  it("shows the axis picker once Add graph is on and saves the chosen axes", async () => {
    const axes: GraphAxes[] = [];
    await render({
      graphScore: normalizeGraphScore({ enabled: true }),
      onGraphAxesChange: (a) => { axes.push(a); },
    });
    expect(document.querySelector("[data-axis-picker]")).toBeTruthy();
    const xBtn = document.querySelector("[data-axis-x]") as HTMLButtonElement;
    await act(async () => { xBtn.click(); });
    const xOpt = document.querySelector("[data-axis-option='0']") as HTMLButtonElement;
    await act(async () => { xOpt.click(); });
    const yBtn = document.querySelector("[data-axis-y]") as HTMLButtonElement;
    await act(async () => { yBtn.click(); });
    const yOpt = document.querySelector("[data-axis-option='1']") as HTMLButtonElement;
    await act(async () => { yOpt.click(); });
    expect(axes.at(-1)).toEqual({ xCol: 0, yCol: 1 });
  });
});
