import { describe, expect, it } from "vitest";
import { notesDueOnLineChange } from "@/lib/smartboard/noteGuidance";

const notes: Record<number, string> = { 0: "The base is the number being multiplied repeatedly.", 1: "", 2: "The index tells us how many times." };
const base = { lineCount: 4, noteFor: (k: number) => notes[k] ?? "", shown: new Set<number>(), userDriven: true };

describe("notesDueOnLineChange", () => {
  it("auto-advance after a correct line shows the left line's note", () => {
    expect(notesDueOnLineChange({ ...base, from: 0, to: 1 })).toEqual([0]);
    expect(notesDueOnLineChange({ ...base, from: 2, to: 3 })).toEqual([2]);
  });
  it("forward jump shows only the line left, never a future line", () => {
    expect(notesDueOnLineChange({ ...base, from: 0, to: 3 })).toEqual([0]);
    expect(notesDueOnLineChange({ ...base, from: 1, to: 3 })).toEqual([]);
  });
  it("no note authored → nothing invented", () => {
    expect(notesDueOnLineChange({ ...base, from: 1, to: 2 })).toEqual([]);
    expect(notesDueOnLineChange({ ...base, noteFor: () => "   ", from: 0, to: 1 })).toEqual([]);
  });
  it("once per attempt: already shown/dismissed is not reopened; Back never opens", () => {
    expect(notesDueOnLineChange({ ...base, shown: new Set([0]), from: 0, to: 1 })).toEqual([]);
    expect(notesDueOnLineChange({ ...base, from: 2, to: 1 })).toEqual([]);
    expect(notesDueOnLineChange({ ...base, from: 1, to: 1 })).toEqual([]);
  });
  it("programmatic restore / remote mirror / first observation never write", () => {
    expect(notesDueOnLineChange({ ...base, userDriven: false, from: 0, to: 1 })).toEqual([]);
    expect(notesDueOnLineChange({ ...base, from: null, to: 2 })).toEqual([]);
  });
  it("a new attempt (cleared shown set) shows notes again", () => {
    const shown = new Set([0]);
    expect(notesDueOnLineChange({ ...base, shown, from: 0, to: 1 })).toEqual([]);
    expect(notesDueOnLineChange({ ...base, shown: new Set(), from: 0, to: 1 })).toEqual([0]);
  });
  it("out-of-range source line is ignored", () => {
    expect(notesDueOnLineChange({ ...base, from: 7, to: 8 })).toEqual([]);
  });
});
