import { describe, expect, it } from "vitest";
import { buildReservoirs } from "../presentation";

function lesson(family: string, nodeType = "smartTable", attrs = {}) {
  const grid = { objId: "table-1", label: "Statistics", rows: 1, cols: 3,
    headers: ["x", "x − μ", "(x − μ)²"], cells: [["12", "−3", "9"]],
    subcells: { "0:1": { expr: "12-15" } } };
  const table = { objId: "table-1", grid, orientation: "row", cellKeys: ["0:0", "0:1", "0:2"], retained: ["0:0"] };
  return [{ id: "section", notebook_id: "notebook", kind: "example", order_index: 0, loose: [],
    subsections: [{ id: "question", section_id: "section", order_index: 0,
      blocks: [{ id: "problem", section_id: "section", subsection_id: "question", kind: "problem", content_ascii: "Find the variance", order_index: 0 },
        { id: "solution", section_id: "section", subsection_id: "question", kind: "solution", content_ascii: "Create a table", order_index: 1 }],
      floating_highlights: [{ uid: "table-highlight", payload: "", object: { objId: "table-1", family, nodeType, attrs, label: "Statistics", afterLine: 0 } }],
      floating_lines: [{ lineId: "row-1", sourceUid: "table-highlight", equation: "12 −3 9", fillers: ["12", "−3", "9"], table }],
    }] }];
}

describe("saved table workspace compatibility", () => {
  it.each([
    ["table", "smartTable", {}],
    ["diagram", "smartTable", {}],
    ["diagram", "mathVisual", { family: "smarttable" }],
  ])("retains the full table snapshot for %s / %s", (family, nodeType, attrs) => {
    const [reservoir] = buildReservoirs(lesson(family as string, nodeType as string, attrs) as any);
    expect(reservoir.lines).toHaveLength(1);
    expect(reservoir.lines[0].table).toMatchObject({ objId: "table-1", retained: ["0:0"],
      grid: { cells: [["12", "−3", "9"]], subcells: { "0:1": { expr: "12-15" } } } });
    expect(reservoir.fragments).toEqual(["12", "−3", "9"]);
  });

  it("does not turn a genuine geometry diagram into a floating table", () => {
    const [reservoir] = buildReservoirs(lesson("diagram", "geometryDiagram") as any);
    expect(reservoir.lines.every(line => !line.table)).toBe(true);
  });
});
