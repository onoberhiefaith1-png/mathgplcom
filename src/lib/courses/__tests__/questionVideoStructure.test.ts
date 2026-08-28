import { describe, expect, it } from "vitest";

import {
  CONCLUSION_KEY,
  INTRO_KEY,
  emptyVideoConfig,
  lineKey,
  sectionForLine,
  sectionsFor,
  shouldAutoPlay,
  videoLinesFromQuestion,
  type QuestionVideoConfig,
} from "../questionVideo";

const cfg = (over: Partial<QuestionVideoConfig> = {}): QuestionVideoConfig => ({
  ...emptyVideoConfig(),
  videoPath: "v.mp4",
  duration: 300,
  ...over,
});

const question = [
  { lineId: "L1", chips: [], equationAscii: "" },
  { lineId: "L2", chips: ["5x", "+", "2x^{2}", "=", "0"] },
  { lineId: "note-0", noteOnly: true, note: "Compare with ax² + bx + c = 0:" },
  { lineId: "L3", equationAscii: "2x^{2} + 5x − 3" },
];

describe("line identity comes from the line id, never from floating numbers", () => {
  it("keeps Line 1 first and reports NULL content as null", () => {
    const lines = videoLinesFromQuestion(question);
    expect(lines.map((l) => [l.lineId, l.label, l.preview])).toEqual([
      ["L1", "Line 1", null],
      ["L2", "Line 2", "5x  +  2x^{2}  =  0"],
      // A standalone note is still its own numbered line, reported as NULL.
      ["note-0", "Line 3", null],
      ["L3", "Line 4", "2x^{2} + 5x − 3"],
    ]);
  });

  it("maps a NULL line to its own range and never to another line's", () => {
    const lines = videoLinesFromQuestion(question);
    const sections = sectionsFor(
      lines,
      cfg({
        segments: [
          { key: lineKey("L1"), start: 21, end: 45 },
          { key: lineKey("L2"), start: 46, end: 75 },
          { key: lineKey("L3"), start: 76, end: 110 },
        ],
      }),
    );
    const one = sectionForLine(sections, "L1");
    expect(one?.key).toBe(lineKey("L1"));
    expect([one?.startAt, one?.endAt]).toEqual([21, 45]);
    expect(one?.preview).toBeNull();
    expect(sectionForLine(sections, "L2")?.startAt).toBe(46);
  });
});

describe("Introduction and Conclusion are optional events, not numbered lines", () => {
  const lines = videoLinesFromQuestion(question);
  const segments = [
    { key: INTRO_KEY, start: 0, end: 20 },
    { key: lineKey("L1"), start: 21, end: 45 },
    { key: lineKey("L2"), start: 46, end: 75 },
    { key: lineKey("L3"), start: 76, end: 110 },
    { key: CONCLUSION_KEY, start: 111, end: 130 },
  ];

  it("adds no rows at all by default", () => {
    const sections = sectionsFor(lines, cfg({ segments }));
    expect(sections.map((s) => s.key)).toEqual([
      lineKey("L1"),
      lineKey("L2"),
      lineKey("note-0"),
      lineKey("L3"),
    ]);
  });

  it("never renumbers or re-keys a line when toggled on", () => {
    const off = sectionsFor(lines, cfg({ segments }));
    const on = sectionsFor(
      lines,
      cfg({ segments, introEnabled: true, conclusionEnabled: true }),
    );
    const numbered = on.filter((s) => s.lineId);
    expect(numbered.map((s) => [s.key, s.label, s.startAt, s.endAt])).toEqual(
      off.map((s) => [s.key, s.label, s.startAt, s.endAt]),
    );
    // The optional events carry no line identity and no line number.
    const intro = on.find((s) => s.key === INTRO_KEY)!;
    const conclusion = on.find((s) => s.key === CONCLUSION_KEY)!;
    for (const s of [intro, conclusion]) {
      expect(s.lineId).toBeNull();
      expect(s.required).toBe(false);
      expect(s.label).not.toMatch(/^Line/);
    }
    expect(on[0]!.key).toBe(INTRO_KEY);
    expect(on[on.length - 1]!.key).toBe(CONCLUSION_KEY);
    expect(sectionForLine(on, "L1")?.key).toBe(lineKey("L1"));
  });
});

describe("opening behaviour", () => {
  it("plays nothing on open when there is no Introduction", () => {
    const sections = sectionsFor(videoLinesFromQuestion(question), cfg());
    expect(sections.some((s) => s.key === INTRO_KEY)).toBe(false);
  });

  it("has an Introduction section to auto-play when enabled", () => {
    const sections = sectionsFor(
      videoLinesFromQuestion(question),
      cfg({ introEnabled: true, segments: [{ key: INTRO_KEY, start: 0, end: 20 }] }),
    );
    const intro = sections.find((s) => s.key === INTRO_KEY);
    expect(intro?.configured).toBe(true);
  });

  it("replays a line that is not yet correct and leaves a correct line alone", () => {
    expect(shouldAutoPlay({ lineCompleted: false })).toBe(true);
    expect(shouldAutoPlay({ lineCompleted: true })).toBe(false);
  });
});
