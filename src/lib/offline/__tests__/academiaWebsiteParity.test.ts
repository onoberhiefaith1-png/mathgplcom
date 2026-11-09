import { describe, expect, it } from "vitest";
import { buildReservoirs } from "@/lib/smartboard/presentation";
import { compileOfflineBoard, packActivityLines, withAuthoredNotes, ACADEMIA_PACK_SCHEMA } from "../academiaPack";
import type { FloatingLine } from "@/lib/lessonnotes/floatingCompile";
import { buildTableGroups, lessonSteps, mainTagForStep } from "@/lib/smartboard/tableActivity";
import type { ReservoirLine } from "@/lib/smartboard/presentation";

const grid = {
  objId: "tbl-sd",
  label: "Heights",
  rows: 5,
  cols: 3,
  headers: ["x", "x - \\bar{x}", "(x - \\bar{x})²"],
  cells: [["3", "-3", "9"], ["5", "-1", "1"], ["6", "0", "0"], ["7", "1", "1"], ["9", "3", "9"]],
};

const tableCol = (lineId: string, equation: string, fillers: string[], cellKeys: string[], orientation: "column" | "subcell" = "column") => ({
  lineId,
  equation,
  fillers,
  containers: [],
  arrangement: fillers.map((_, i) => i),
  marks: 2,
  table: { objId: "tbl-sd", grid, orientation, cellKeys, retained: [] },
});

/** Like the published pack: only table workspace lines were saved. */
const tableOnlyLines = [
  tableCol("t-x", "3  5  6  7  9", ["3", "5", "6", "7", "9"], ["0:0", "1:0", "2:0", "3:0", "4:0"]),
  tableCol("t-dev", "-3  -1  0  1  3", ["-3", "-1", "0", "1", "3"], ["0:1", "1:1", "2:1", "3:1", "4:1"]),
  tableCol("t-sq", "9  1  0  1  9", ["9", "1", "0", "1", "9"], ["0:2", "1:2", "2:2", "3:2", "4:2"]),
  tableCol("t-s0", "3 − 6", ["3", "−", "6"], ["0:1"], "subcell"),
];

const sandwichHighlights = [
  { uid: "h-sum", payload: "3 + 5 + 6 + 7 + 9 = 30", precedingNotebook: "Find the mean first." },
  { uid: "h-mean", payload: "\\bar{x} = 30 / 5 = 6" },
  { uid: "h-table", payload: "", object: { objId: "tbl-sd", family: "table", nodeType: "smartTable", attrs: {}, label: "Heights" } },
  { uid: "h-var", payload: "\\sigma^2 = 20 / 5 = 4" },
  { uid: "h-sd", payload: "\\sigma = 2" },
];

const parseLines = (raw: unknown, questionKey: unknown) => {
  const all = (Array.isArray(raw) ? raw : []).filter(
    (line): line is FloatingLine => !!line && typeof line === "object" && typeof (line as FloatingLine).equation === "string" && !!(line as FloatingLine).equation.trim(),
  );
  const own = typeof questionKey === "string" && questionKey
    ? all.filter((line) => !line.questionId || line.questionId === questionKey)
    : all;
  return (own.length ? own : all).map((line, index) => ({
    ...line,
    id: line.lineId || `line-${index + 1}`,
    marks: Math.max(0, Number(line.marks) || 0),
  }));
};

const questionText = "The heights of 5 potted seedlings in centimetres are 3, 5, 6, 7, and 9. Calculate the population standard deviation of their heights.";

const websiteLines = (highlights: unknown, floatingLines: unknown, prompt = questionText) => {
  const sections = [{
    id: "section", notebook_id: "notebook", kind: "example", order_index: 0, loose: [],
    subsections: [{
      id: "question", section_id: "section", order_index: 0,
      blocks: [
        { id: "problem", section_id: "section", subsection_id: "question", kind: "problem", content_ascii: prompt, order_index: 0 },
        { id: "solution", section_id: "section", subsection_id: "question", kind: "solution", content_ascii: "", order_index: 1 },
      ],
      floating_highlights: highlights,
      floating_lines: floatingLines,
    }],
  }];
  return buildReservoirs(sections as never)[0]!.lines;
};

const snapshot = (lines: Array<{ equation?: string; table?: { objId?: string } | null; notebookOnly?: boolean; notebook?: string; noteOnly?: boolean; note?: string; fillers?: string[]; chips?: string[] }>) =>
  lines.map((l) => ({
    equation: String(l.equation ?? ""),
    table: l.table?.objId ?? null,
    note: String((l as { notebook?: string }).notebook ?? (l as { note?: string }).note ?? ""),
    noteOnly: !!(l.notebookOnly || (l as { noteOnly?: boolean }).noteOnly),
    chips: (l.fillers ?? (l as { chips?: string[] }).chips ?? []).slice(),
  }));

const expectedSandwich = [
  { equation: "3 + 5 + 6 + 7 + 9 = 30", table: null, note: "Find the mean first.", noteOnly: false },
  { equation: "\\bar{x} = 30 / 5 = 6", table: null, note: "", noteOnly: false },
  { equation: "3  5  6  7  9", table: "tbl-sd", note: "", noteOnly: false },
  { equation: "-3  -1  0  1  3", table: "tbl-sd", note: "", noteOnly: false },
  { equation: "9  1  0  1  9", table: "tbl-sd", note: "", noteOnly: false },
  { equation: "3 − 6", table: "tbl-sd", note: "", noteOnly: false },
  { equation: "\\sigma^2 = 20 / 5 = 4", table: null, note: "", noteOnly: false },
  { equation: "\\sigma = 2", table: null, note: "", noteOnly: false },
];

const stripChips = (rows: ReturnType<typeof snapshot>) => rows.map(({ chips: _c, ...rest }) => rest);

describe("Academia website vs app/offline pack line parity", () => {
  it("bumps the pack schema so installed apps refresh the compiled lines", () => {
    expect(ACADEMIA_PACK_SCHEMA).toBe(9);
  });

  it("website keeps pre-table mean lines, the table, then post-table SD lines", () => {
    const lines = websiteLines(sandwichHighlights, tableOnlyLines);
    expect(stripChips(snapshot(lines))).toEqual(expectedSandwich);
    const groups = buildTableGroups(lines as ReservoirLine[]);
    const steps = lessonSteps(lines.length, groups);
    expect(steps.map((_, i) => mainTagForStep(steps, i))).toEqual(["L1", "L2", "T1", "L3", "L4"]);
  });

  it("legacy parseLines + withAuthoredNotes dropped the mean and SD lines", () => {
    const packed = withAuthoredNotes(parseLines(tableOnlyLines, null) as never, sandwichHighlights, "question");
    const board = compileOfflineBoard({
      activityId: "a", subsectionId: "s", title: "Standard deviation",
      lines: packed, questionText,
    })!;
    const eqs = board.boardSource.reservoirs[0]!.lines.map((l) => l.equation);
    expect(eqs).not.toContain("3 + 5 + 6 + 7 + 9 = 30");
    expect(eqs).not.toContain("\\sigma = 2");
    expect(eqs[0]).toBe("3  5  6  7  9");
  });

  it("packActivityLines matches the website line order, table membership, notes and chips", () => {
    const web = websiteLines(sandwichHighlights, tableOnlyLines);
    const packed = packActivityLines(tableOnlyLines, sandwichHighlights, "question", null);
    const board = compileOfflineBoard({
      activityId: "a", subsectionId: "s", title: "Standard deviation",
      lines: packed, questionText,
    })!;
    const packRows = board.boardSource.reservoirs[0]!.lines;
    expect(stripChips(snapshot(packRows))).toEqual(expectedSandwich);
    expect(snapshot(packRows)).toEqual(snapshot(web));
    const groups = buildTableGroups(packRows as ReservoirLine[]);
    const steps = lessonSteps(packRows.length, groups);
    expect(steps.map((_, i) => mainTagForStep(steps, i))).toEqual(["L1", "L2", "T1", "L3", "L4"]);
  });

  it("does not swallow pre-table mean lines that were wrongly stamped with the table", () => {
    const stamped = [
      { lineId: "mean", sourceUid: "h-mean", equation: "\\bar{x} = 30 / 5 = 6", fillers: ["x̄", "=", "6"], containers: [], arrangement: [0, 1, 2], marks: 1, table: { objId: "tbl-sd", grid, orientation: "column" as const, cellKeys: ["0:0"], retained: [] } },
      ...tableOnlyLines,
    ];
    const web = websiteLines(sandwichHighlights, stamped);
    const pack = compileOfflineBoard({
      activityId: "a", subsectionId: "s", title: "Standard deviation",
      lines: packActivityLines(stamped, sandwichHighlights, "question", null),
      questionText,
    })!.boardSource.reservoirs[0]!.lines;
    expect(stripChips(snapshot(web))).toEqual(expectedSandwich);
    expect(snapshot(pack)).toEqual(snapshot(web));
    expect(web.filter((l) => l.equation === "\\bar{x} = 30 / 5 = 6")).toHaveLength(1);
  });

  it("turns a highlighted geometry diagram into a note-only row in both paths", () => {
    const highlights = [
      { uid: "h-diag", payload: "", object: { objId: "tri-1", family: "diagram", nodeType: "geometryDiagram", label: "Triangle" }, precedingNotebook: "Look at the diagram." },
      { uid: "h1", payload: "a = 3" },
    ];
    const lines = [{ lineId: "l1", sourceUid: "h1", equation: "a = 3", fillers: ["a", "=", "3"], containers: [], arrangement: [0, 1, 2], marks: 1 }];
    const web = websiteLines(highlights, lines, "Find a.");
    const pack = compileOfflineBoard({
      activityId: "a", subsectionId: "s", title: "Diagram",
      lines: packActivityLines(lines, highlights, "question", null),
      questionText: "Find a.",
    })!.boardSource.reservoirs[0]!.lines;
    expect(web[0]?.notebookOnly).toBe(true);
    expect(web[0]?.noteObjects?.length).toBeGreaterThan(0);
    expect(pack[0]?.notebookOnly).toBe(true);
    expect(pack[0]?.noteObjects?.length).toBeGreaterThan(0);
    expect(pack[0]?.equation).toBe("");
    expect(pack[1]?.equation).toBe("a = 3");
    expect(snapshot(pack).map(({ chips: _c, ...rest }) => rest)).toEqual(snapshot(web).map(({ chips: _c, ...rest }) => rest));
  });

  it("keeps fraction containers and multi-line floating numbers aligned", () => {
    const highlights = [
      { uid: "h1", payload: "1/2 + 1/3 = 5/6" },
      { uid: "h2", payload: "5/6" },
    ];
    const lines = [
      { lineId: "l1", sourceUid: "h1", equation: "1/2 + 1/3 = 5/6", fillers: ["1/2", "+", "1/3", "=", "5/6"], containers: ["fraction"], arrangement: [0, 1, 2, 3, 4], marks: 1 },
      { lineId: "l2", sourceUid: "h2", equation: "5/6", fillers: ["5/6"], containers: ["fraction"], arrangement: [0], marks: 1 },
    ];
    const web = websiteLines(highlights, lines, "Add the fractions.");
    const pack = compileOfflineBoard({
      activityId: "a", subsectionId: "s", title: "Fractions",
      lines: packActivityLines(lines, highlights, "question", null),
      questionText: "Add the fractions.",
    })!.boardSource.reservoirs[0]!.lines;
    expect(pack.map((l) => l.containers)).toEqual(web.map((l) => l.containers));
    expect(snapshot(pack)).toEqual(snapshot(web));
  });

  it("falls back to saved floating_lines when no highlights exist", () => {
    const web = websiteLines([], tableOnlyLines);
    const pack = compileOfflineBoard({
      activityId: "a", subsectionId: "s", title: "Standard deviation",
      lines: packActivityLines(tableOnlyLines, [], "question", null),
      questionText,
    })!.boardSource.reservoirs[0]!.lines;
    expect(pack.every((l) => l.table?.objId === "tbl-sd")).toBe(true);
    expect(snapshot(pack)).toEqual(snapshot(web));
  });

  it("filters by question_key the same way in both paths when keys are present", () => {
    const mixed = [
      { ...tableOnlyLines[0], questionId: "q-a" },
      { lineId: "other", questionId: "q-b", equation: "x = 1", fillers: ["x", "=", "1"], containers: [], arrangement: [0, 1, 2], marks: 1 },
    ];
    const highlights = [
      { uid: "h-table", payload: "", object: { objId: "tbl-sd", family: "table", nodeType: "smartTable", attrs: {}, label: "Heights" }, questionId: "q-a" },
      { uid: "h-b", payload: "x = 1", questionId: "q-b" },
    ];
    const packedA = packActivityLines(mixed, highlights, "question", "q-a");
    expect(packedA.map((l) => l.equation)).toEqual(["3  5  6  7  9"]);
    const packedB = packActivityLines(mixed, highlights, "question", "q-b");
    expect(packedB.map((l) => l.equation)).toEqual(["x = 1"]);
  });
});
