// STRICT ONE-TO-ONE MAPPING: solution line → floating number → video timeline.
// A line with no floating number is NULL, never removed, and never lets the
// next line's floating number or timeline move up into its place.
import { describe, expect, it } from "vitest";

import {
  CONCLUSION_KEY,
  INTRO_KEY,
  emptyVideoConfig,
  lineKey,
  sectionForLine,
  sectionsFor,
  videoLinesFromQuestion,
  type QuestionVideoConfig,
} from "../questionVideo";

const cfg = (over: Partial<QuestionVideoConfig> = {}): QuestionVideoConfig => ({
  ...emptyVideoConfig(),
  videoPath: "v.mp4",
  duration: 600,
  ...over,
});

// Exactly the board in the report: Line 1 is a note with no floating numbers.
const question = [
  { lineId: "L1", noteOnly: true, note: "For", chips: [] },
  { lineId: "L2", chips: ["2x^{2}", "+", "5x", "−", "3", "=", "0"] },
  { lineId: "L3", chips: [], equationAscii: "−5 ± √49" },
  { lineId: "L4", chips: ["x", "=", "0.5"] },
];

describe("no line is dropped or renumbered", () => {
  it("keeps a note-only line as Line 1 with NULL floating numbers", () => {
    const lines = videoLinesFromQuestion(question);
    expect(lines.map((l) => [l.label, l.lineId, l.preview])).toEqual([
      ["Line 1", "L1", null],
      ["Line 2", "L2", "2x^{2}  +  5x  −  3  =  0"],
      ["Line 3", "L3", "−5 ± √49"],
      ["Line 4", "L4", "x  =  0.5"],
    ]);
    expect(lines[0]!.note).toBe("For");
  });

  it("never lets Line 2's floating numbers or timeline appear on Line 1", () => {
    const sections = sectionsFor(
      videoLinesFromQuestion(question),
      cfg({
        segments: [
          { key: lineKey("L1"), start: 19, end: 74 },
          { key: lineKey("L2"), start: 75, end: 128 },
          { key: lineKey("L4"), start: 200, end: 240 },
        ],
      }),
    );
    const one = sectionForLine(sections, "L1")!;
    expect(one.label).toBe("Line 1");
    expect(one.preview).toBeNull();
    expect([one.startAt, one.endAt]).toEqual([19, 74]);

    const two = sectionForLine(sections, "L2")!;
    expect(two.preview).toContain("2x^{2}");
    expect([two.startAt, two.endAt]).toEqual([75, 128]);

    // A mid-sequence line with no timeline yet cannot pull Line 4's up.
    expect(sectionForLine(sections, "L3")).toMatchObject({ startAt: null, endAt: null });
    expect(sectionForLine(sections, "L4")).toMatchObject({ startAt: 200, endAt: 240 });
  });

  it("matches the Smartboard preview's numbering line for line", () => {
    // The preview numbers every reservoir line, notes included.
    const previewLabels = question.map((_, i) => `Line ${i + 1}`);
    expect(videoLinesFromQuestion(question).map((l) => l.label)).toEqual(previewLabels);
  });
});

describe("Introduction and Conclusion never enter the line sequence", () => {
  it("adds them as optional events with no line number and no floating number", () => {
    const lines = videoLinesFromQuestion(question);
    const off = sectionsFor(lines, cfg());
    const on = sectionsFor(lines, cfg({ introEnabled: true, conclusionEnabled: true }));

    expect(on[0]!.key).toBe(INTRO_KEY);
    expect(on[on.length - 1]!.key).toBe(CONCLUSION_KEY);
    for (const s of [on[0]!, on[on.length - 1]!]) {
      expect(s.lineId).toBeNull();
      expect(s.required).toBe(false);
      expect(s.preview).toBeNull();
    }
    // Numbered lines are byte-identical with and without the optional events.
    expect(on.filter((s) => s.lineId).map((s) => [s.key, s.label, s.preview])).toEqual(
      off.map((s) => [s.key, s.label, s.preview]),
    );
  });
});
