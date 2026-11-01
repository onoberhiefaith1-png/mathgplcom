import { describe, it, expect } from "vitest";
import { withoutQuestionEcho, releaseErasedNoteRows, keepSensorOnCurrentRow, firstSolutionEntry } from "../solutionFlow";
import { noteForLine } from "@/lib/smartboard/boardWriter/noteSource";

describe("Question and solution note separation", () => {
  const question = "Solve the equation: 3y - 5 = 10";
  it("does not write the copied question below Solution", () => {
    expect(withoutQuestionEcho(question, question)).toBe("");
  });
  it("recognises a question label and wrapped whitespace", () => {
    expect(withoutQuestionEcho("Question 1: Solve the equation:\n3y - 5 = 10", question)).toBe("");
  });
  it("retains the teacher explanation after a copied leading question", () => {
    expect(withoutQuestionEcho(question + "\n\nAdd 5 to both sides.", question)).toBe("Add 5 to both sides.");
  });
  it("removes the question before prose purity drops its separate equation row", () => {
    const q = "Solve the equation:\n3y - 5 = 10";
    const source = { notebook: q + "\nAdd 5 to both sides." };
    expect(noteForLine({ ...source, notebook: withoutQuestionEcho(source.notebook, q) })).toBe("Add 5 to both sides.");
    expect(source.notebook).toContain(q);
  });
  it("does not erase a genuine first algebra step or its fragments", () => {
    const line = { equation: "3y - 5 = 10", fillers: ["3y", "-5", "=", "10"], notebook: "Add 5 to both sides." };
    const displayed = { ...line, notebook: withoutQuestionEcho(line.notebook, question) };
    expect(displayed).toEqual(line);
  });
  it("leaves partial matches and later recaps alone", () => {
    expect(withoutQuestionEcho("Solve the equation: 3y - 5 = 100", question)).toContain("100");
    expect(withoutQuestionEcho("Recall the method.\n" + question, question)).toContain(question);
  });
  it("preserves diagram objects when only the duplicate prose is suppressed", () => {
    const object = { id: "diagram" }; const line = { notebook: question, noteObjects: [object] };
    const shown = { ...line, notebook: withoutQuestionEcho(line.notebook, question) };
    expect(shown.noteObjects).toEqual([object]); expect(shown.notebook).toBe("");
  });
});
describe("Erased note row reuse", () => {
  const ink = (row: string) => row.length > 0;
  it("makes an erased note row available to the writing sensor", () => {
    const locked = new Set([4, 8]);
    const released = releaseErasedNoteRows(locked, { 4: "question", 8: "explanation" }, { 8: "explanation" }, ink);
    expect([...released]).toEqual([8]); expect([...locked]).toEqual([4, 8]);
  });
  it("releases the row when its final character is deleted", () => {
    expect(releaseErasedNoteRows(new Set([4]), { 4: "x" }, { 4: "" }, ink).has(4)).toBe(false);
  });
  it("keeps a row locked while half-row content still exists", () => {
    const locked = new Set([4]);
    expect(releaseErasedNoteRows(locked, { 4: "note", 4.5: "fraction" }, { 4.5: "fraction" }, ink)).toBe(locked);
  });
  it("preserves object-only reservations and hydration with no previous ink", () => {
    const locked = new Set([4]);expect(releaseErasedNoteRows(locked, {}, {}, ink)).toBe(locked);
  });
});
describe("Stable writing sensor", () => {
  const base = { logicalLineChanged: false, row: 4, bandStart: 4, bandEnd: 16, locked: new Set<number>() };
  it("stays immediately below Solution while typing", () => { expect(keepSensorOnCurrentRow(base)).toBe(true); });
  it("honours an upward manual move and subsequent typing", () => { expect(keepSensorOnCurrentRow({ ...base, row: 6 })).toBe(true); });
  it("does not jump down just because a stacked expression changed the physical caret row", () => { expect(keepSensorOnCurrentRow({ ...base, row: 6.5 })).toBe(true); });
  it("allows explicit logical-line changes to advance the sensor", () => { expect(keepSensorOnCurrentRow({ ...base, logicalLineChanged: true })).toBe(false); });
  it("protects the question caption and note rows", () => {
    expect(keepSensorOnCurrentRow({ ...base, row: 3 })).toBe(false);
    expect(keepSensorOnCurrentRow({ ...base, locked: new Set([4]) })).toBe(false);
    expect(keepSensorOnCurrentRow({ ...base, row: 17 })).toBe(false);
  });
});

it("starts at the first real equation without renumbering saved lines", () => {
  const lines = [{ lineId: "question-note", notebookOnly: true, notebook: "Find y." }, { lineId: "work", equation: "3y=15", fragmentStart: 0, fragmentEnd: 3 }];
  expect(firstSolutionEntry(lines, "Find y.")).toBe(1);expect(lines[1].lineId).toBe("work");expect(lines).toHaveLength(2);
});
it("does not skip a genuine introductory note, diagram or working equation", () => {
  expect(firstSolutionEntry([{ notebookOnly: true, notebook: "Use inverse operations." }, { equation: "3y=15" }], "Find y.")).toBe(0);
  expect(firstSolutionEntry([{ notebookOnly: true, notebook: "Find y.", noteObjects: [{}] }, { equation: "3y=15" }], "Find y.")).toBe(0);
  expect(firstSolutionEntry([{ equation: "3y-5=10" }, { equation: "3y=15" }], "3y-5=10")).toBe(0);
});

it("never conflates superscripts with baseline digits in a question", () => {
  expect(withoutQuestionEcho("Find x2.", "Find x².")).toBe("Find x2.");
});
