import { describe, expect, it } from "vitest";
import { compileOfflineBoard, withAuthoredNotes } from "../academiaPack";
import { noteForLine } from "@/lib/smartboard/boardWriter/noteSource";

// Mirrors the Academia app question "Identify the base and index in 2^{5}".
const floating = [
  { lineId: "l1", sourceUid: "hl_a", equation: "2^5 = 2×2×2×2×2", fillers: ["2^5", "=", "2×2×2×2×2"], containers: [], arrangement: [], marks: 2 },
  { lineId: "l2", equation: "base = 2", groupId: 2, fillers: ["base", "=", "2"], containers: [], arrangement: [], marks: 1 },
];
const highlights = [
  { uid: "hl_a", groupId: 1, payload: "2^5 = 2×2×2×2×2", precedingNotebook: "The base is the number being multiplied repeatedly." },
  { groupId: 2, payload: "base = 2", precedingNotebook: "The index tells us how many times the base appears as a factor." },
];
const compile = (lines: typeof floating) => compileOfflineBoard({
  activityId: "a", subsectionId: "s", title: "index notation", questionText: "Identify the base and index in 2^{5}.", lines: lines as never,
});

describe("Academia app pack carries authored notes to the Smartboard", () => {
  it("the board source the app hands PresentationView exposes each line's own note", () => {
    const board = compile(withAuthoredNotes(floating as never, highlights, "s") as never);
    const lines = board!.boardSource.reservoirs[0]!.lines;
    expect(lines.map((l) => noteForLine(l))).toEqual([
      "The base is the number being multiplied repeatedly.",
      "The index tells us how many times the base appears as a factor.",
    ]);
    expect(board!.lineNotes).toEqual(lines.map((l) => noteForLine(l)));
  });

  it("never changes equations, chips, marks or line ids", () => {
    const before = compile(floating);
    const after = compile(withAuthoredNotes(floating as never, highlights, "s") as never);
    expect(after!.lineIds).toEqual(before!.lineIds);
    expect(after!.lineMarks).toEqual(before!.lineMarks);
    expect(after!.boardSource.reservoirs[0]!.lines.map((l) => [l.equation, l.fillers])).toEqual(
      before!.boardSource.reservoirs[0]!.lines.map((l) => [l.equation, l.fillers]));
  });

  it("without highlights the old pack had no notes (the reported defect)", () => {
    const board = compile(floating);
    expect(board!.boardSource.reservoirs[0]!.lines.map((l) => noteForLine(l))).toEqual(["", ""]);
  });
});
