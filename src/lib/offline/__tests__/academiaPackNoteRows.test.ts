import { describe, expect, it } from "vitest";
import { compileOfflineBoard, withAuthoredNotes } from "../academiaPack";
import { noteForLine } from "@/lib/smartboard/boardWriter/noteSource";

// The photographed Mathemagine question "quadratic formula".
const eq = (lineId: string, sourceUid: string, equation: string, marks = 1) =>
  ({ lineId, sourceUid, equation, fillers: equation.split(" "), containers: [], arrangement: [], marks });
const floating = [
  eq("l1", "h1", "2x^2 + 5x - 1 = 0"), eq("l2", "h2", "ax^2 + bx + c = 0"),
  eq("l3", "h3", "a = 2"), eq("l4", "h4", "b = 5"), eq("l5", "h5", "c = -1"),
  eq("l6", "h6", "x = (-b ± sqrt(b^2 - 4ac))/(2a)", 2),
];
const highlights = [
  { uid: "n1", notebookOnly: true, precedingNotebook: "Compare" },
  { uid: "h1", payload: "2x^2 + 5x - 1 = 0" },
  { uid: "n2", notebookOnly: true, precedingNotebook: "with the standard form" },
  { uid: "h2", payload: "ax^2 + bx + c = 0" },
  { uid: "h3", payload: "a = 2" }, { uid: "h4", payload: "b = 5" }, { uid: "h5", payload: "c = -1" },
  { uid: "n3", notebookOnly: true, precedingNotebook: "State the quadratic formula:" },
  { uid: "h6", payload: "x = (-b ± sqrt(b^2 - 4ac))/(2a)", precedingNotebook: "Substitute next." },
];
const compile = (lines: unknown[]) => compileOfflineBoard({
  activityId: "a", subsectionId: "s", title: "quadratic formula", lines: lines as never,
  questionText: "Solve 2x²+5x−1=0 using the quadratic formula, leaving your answers in exact surd form.",
});

describe("Mathemagine pack keeps standalone guidance rows in authored order", () => {
  it("board source handed to PresentationView has Compare first, then guidance at its step", () => {
    const board = compile(withAuthoredNotes(floating as never, highlights, "s"))!;
    const rows = board.boardSource.reservoirs[0]!.lines.map((l) => [l.equation, noteForLine(l), !!l.notebookOnly]);
    expect(rows).toEqual([
      ["", "Compare", true], ["2x^2 + 5x - 1 = 0", "", false],
      ["", "with the standard form", true], ["ax^2 + bx + c = 0", "", false],
      ["a = 2", "", false], ["b = 5", "", false], ["c = -1", "", false],
      ["", "State the quadratic formula:", true], ["x = (-b ± sqrt(b^2 - 4ac))/(2a)", "Substitute next.", false],
    ]);
    expect(board.lineNoteOnly.filter(Boolean)).toHaveLength(3);
    expect(board.lineHasFloatingNumbers.filter((x, i) => board.lineNoteOnly[i] && x)).toEqual([]);
  });

  it("note rows never add marks or change equation line ids", () => {
    const before = compile(floating)!;
    const after = compile(withAuthoredNotes(floating as never, highlights, "s"))!;
    expect(after.totalMarks).toBe(before.totalMarks);
    expect(after.lineIds.filter((_, i) => !after.lineNoteOnly[i])).toEqual(before.lineIds);
  });

  it("before the fix (no highlights) there was no guidance at all", () => {
    const board = compile(floating)!;
    expect(board.boardSource.reservoirs[0]!.lines.every((l) => !noteForLine(l))).toBe(true);
  });
});
