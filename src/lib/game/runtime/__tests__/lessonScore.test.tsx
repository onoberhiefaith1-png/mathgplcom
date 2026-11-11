/* eslint-disable @typescript-eslint/no-explicit-any */
// Reproduces the reported lesson (mean of 3, 5, 6, 9, 7): ten correct lines
// showed 30/36 and the table showed "0 of 10" with the HUD at 3/39.
// Every exactly-correct line must pay its full marks the moment it is proved,
// and the "out of" must be exactly the marks that can be paid.
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(() => { throw new Error("no DB in tests"); }) } }));
vi.mock("@/lib/slate/gameSound", () => ({
  applyBackgroundSound: vi.fn(), playRewardSound: vi.fn(), prepareGameSounds: vi.fn(),
  setBackgroundVolume: vi.fn(), stopBackgroundSound: vi.fn(),
}));
vi.mock("@/lib/slate/gameAssignments", () => ({ saveGameQuestionResult: vi.fn() }));

import { provesEquivalent, predict, routeMapFor } from "@/lib/predictive/predictiveLine";
import { toUnicodeMath, isStillDirty } from "@/lib/notebook/unicodeMath";
import { rowToAscii } from "@/lib/smartboard/rowAscii";
import { mkAccent, mkBigOp, mkChar } from "@/lib/smartboard/mathTree";
import { questionAwardableMarks } from "@/lib/game/runtime/awardableMarks";
import { useGameRuntime, type GameRuntime } from "@/hooks/useGameRuntime";

/** The stored answer key, exactly as createAssessment derives it. */
const keyOf = (equation: string) => {
  const uni = toUnicodeMath(equation);
  return (uni && !isStillDirty(uni) ? uni : equation).trim();
};
const proved = (expected: string, student: string) =>
  provesEquivalent(expected, student)
  && predict({ routeMap: routeMapFor({ expectedAscii: expected, atoms: [] }), studentAscii: student }).complete;

// Each lesson line, in the two spellings a teacher's key can have, with the
// ways the student's board line reaches the marking engine.
const LESSON: { key: string[]; student: string[]; wrong: string[] }[] = [
  { key: ["N=5", "N = 5"], student: ["N=5", "N = 5"], wrong: ["N=6"] },
  { key: ["Σx=3+5+6+9+7", "\\Sigma x=3+5+6+9+7", "\\sum x = 3 + 5 + 6 + 9 + 7"],
    student: ["Σx=3 +5 +6 +9 +7", "Σx = 3 + 5 + 6 + 9 + 7", "Σx=3+5+6+9+7"], wrong: ["Σx=3+5+6+9"] },
  { key: ["Σx=30", "\\Sigma x = 30", "\\sum x=30"], student: ["Σx=30", "Σx = 30", "Σ(x)=30"], wrong: ["Σx=31"] },
  { key: ["μ=Σx/N", "\\mu=\\frac{\\Sigma x}{N}", "\\mu = \\frac{\\sum x}{N}"],
    student: ["μ=(Σx)/(N)", "μ=\\frac{Σx}{N}"], wrong: ["μ=Σx"] },
  { key: ["μ=30/5", "\\mu=\\frac{30}{5}"], student: ["μ=(30)/(5)", "μ=30/5", "μ=\\frac{30}{5}"], wrong: ["μ=30/6"] },
  { key: ["μ=6cm", "\\mu=6\\text{cm}", "\\mu = 6\\,\\mathrm{cm}"], student: ["μ=6cm", "μ = 6 cm", "μ=6cm "], wrong: ["μ=6", "μ=6mm"] },
];

describe("every exactly-correct lesson line is proved (plain, sums with spaces, Greek, fractions, units)", () => {
  LESSON.forEach(({ key, student, wrong }) => {
    for (const k of key) {
      it(`${k} accepts ${student.join(" | ")}`, () => {
        const expected = keyOf(k);
        for (const s of student) expect(proved(expected, s), `${expected} <- ${s}`).toBe(true);
        for (const w of wrong) expect(proved(expected, w), `${expected} <- ${w} must NOT pass`).toBe(false);
      });
    }
  });

  it("keeps Σ inside a stored fraction key (\\frac{\\sum x}{N} used to lose the Σ)", () => {
    expect(keyOf("\\mu = \\frac{\\sum x}{N}")).toContain("\\sum");
  });

  it("powers written as superscript or ascii are the same line", () => {
    expect(proved("(x−x̄)²", "(x-x̄)^{2}")).toBe(true);
    expect(proved(keyOf("(x-\\bar{x})^2"), "(x−x̄)²")).toBe(true);
    // x̄ is its own symbol, never plain x.
    expect(proved("x−x̄", "x-x")).toBe(false);
  });

  it("the board writes Σ and x̄ structures as the symbols the key uses", () => {
    const sum = mkBigOp("sum") as any; sum.rows[0] = [mkChar("x")];
    expect(proved("Σx=30", `${rowToAscii([sum])}=30`)).toBe(true);
    const bar = mkAccent("‾") as any; bar.rows[0] = [mkChar("x")];
    expect(rowToAscii([mkChar("x"), mkChar("−"), bar])).toBe("x−x\u0304");
  });
});

/* ── the lesson as a Game question ─────────────────────────────────────── */
const tableGrid = {
  rows: 5, cols: 3,
  headers: ["x", "x−x̄", "(x−x̄)²"],
  cells: [["3", "-3", "9"], ["5", "-1", "1"], ["6", "0", "0"], ["9", "3", "9"], ["7", "1", "1"]],
  // Ten calculated Subcells: both working columns of every row.
  subcells: Object.fromEntries([0, 1, 2, 3, 4].flatMap((r) => [
    [`${r}:1`, { expr: `${["3", "5", "6", "9", "7"][r]}-6` }],
    [`${r}:2`, { expr: `(${["-3", "-1", "0", "3", "1"][r]})^2` }],
  ])),
};
const PLAIN = ["N=5", "Σx=3+5+6+9+7", "Σx=30", "μ=Σx/N", "μ=30/5", "μ=6cm"];
const lines: any[] = [
  ...PLAIN.map((equation, i) => ({ lineId: `l${i}`, marks: 3, equation })),
  // One Game Line per table row (row orientation)...
  ...[0, 1, 2, 3, 4].map((r) => ({ lineId: `row${r}`, marks: 1, table: { objId: "t1", orientation: "row", grid: tableGrid } })),
  // ...and the ten Subcell reservoir lines, which pay through their Subcell.
  ...Object.keys(tableGrid.subcells).map((k) => ({ lineId: `sub${k}`, marks: 1, table: { objId: "t1", orientation: "subcell", grid: tableGrid, cellKeys: [k] } })),
];
const board: any = {
  questionRowId: "q1", boardQuestionId: "bq1", subsectionId: "s", notebookId: "n", assessmentId: "a",
  title: "Mean", questionText: "Find the mean of 3, 5, 6, 9, 7",
  totalMarks: lines.reduce((s, l) => s + l.marks, 0), // 18 + 5 + 10 = 33 (the old "out of")
  boardSource: { beats: [], title: "Mean", reservoirs: [{ beatId: "bq1", caption: "Q", fragments: [], lines }] },
  questionTimerSeconds: null,
  lineTimers: lines.map(() => null),
  lineIds: lines.map((l) => l.lineId),
  lineVaults: lines.map(() => null),
  lineMarks: lines.map((l) => l.marks),
  lineNotes: lines.map(() => null),
  lineNoteOnly: lines.map(() => false),
  lineHasFloatingNumbers: lines.map(() => true),
};
const tables = { t1: Object.fromEntries(Object.keys(tableGrid.subcells).map((k) => [k, { marks: 2 }])) };
const game: any = { id: "g", slots: [], patternLength: 1, settings: { tables } };

describe("the maximum equals the marks that can actually be paid", () => {
  it("counts lines that pay as lines plus each Subcell once — never a Subcell's line as well", () => {
    const m = questionAwardableMarks(board, tables);
    expect(m.subcellMarks).toBe(20); // 10 Subcells × 2 (Game setting)
    expect(m.lineMarks.slice(0, 11)).toEqual([3, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1]);
    expect(m.lineMarks.slice(11).every((x) => x === 0)).toBe(true);
    expect(m.total).toBe(18 + 5 + 20);
  });
  it("note-only lines are never part of the maximum", () => {
    const withNote = { ...board, lineNoteOnly: board.lineNoteOnly.map((_: boolean, i: number) => i === 0) };
    expect(questionAwardableMarks(withNote, tables).total).toBe(3 * 5 + 5 + 20);
  });
});

let root: Root; let host: HTMLElement; let rt: GameRuntime;
function Probe() { rt = useGameRuntime({ game, boards: [board], studentId: null, testMode: true }); return null; }
beforeEach(async () => {
  const dom = new JSDOM("<body></body>", { url: "https://mathgpl.com/game" });
  for (const key of ["window", "document", "navigator", "HTMLElement", "Node", "localStorage"]) vi.stubGlobal(key, (dom.window as any)[key]);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<Probe />));
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });

const award = async (lineId: string, studentAscii: string) =>
  act(async () => rt.onLineAward({ questionId: "bq1", lineId, studentAscii, marks: 999 }));

describe("Game HUD for this lesson", () => {
  it("pays every correct line its full marks immediately and reaches full marks", async () => {
    expect(rt.questionTotalMarks).toBe(43);
    for (const [i, s] of ["N=5", "Σx=3 +5 +6 +9 +7", "Σx=30", "μ=(Σx)/(N)", "μ=(30)/(5)", "μ=6cm"].entries()) {
      await award(`l${i}`, s);
      expect(rt.questionEarnedMarks).toBe((i + 1) * 3); // the caller's 999 is never trusted
    }
    // Table rows pay by their cells; rows with the same values still pay.
    for (const r of [0, 1, 2, 3, 4]) await award(`row${r}`, "6  0  0");
    expect(rt.questionEarnedMarks).toBe(18 + 5);
    expect(rt.completion).toBeNull(); // ten Subcells still to solve
    for (const k of Object.keys(tableGrid.subcells)) await act(async () => rt.awardSubcell("t1", k, 2, true));
    expect(rt.questionEarnedMarks).toBe(43);
    expect(rt.questionEarnedMarks).toBe(rt.questionTotalMarks);
    // Subcell lines complete through their Subcells, so the question completes
    // with every awardable mark earned.
    expect(rt.completion?.summary.marks).toBe(43);
    expect(rt.completion?.summary.totalMarks).toBe(43);
  });
  it("a line is paid once, however often it is proved", async () => {
    await award("l2", "Σx=30");
    await award("l2", "Σx = 30");
    expect(rt.questionEarnedMarks).toBe(3);
  });
});
