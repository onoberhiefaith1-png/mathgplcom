// A section's range belongs to its own line and nothing else. Legacy end-only
// records are adopted once so already-saved videos keep playing.
import { describe, expect, it } from "vitest";
import { emptySectionsFor, sectionsFor, type QuestionVideoConfig, type VideoLine } from "../questionVideo";

const lines: VideoLine[] = [
  { lineId: "a", label: "Line 1" },
  { lineId: "b", label: "Line 2" },
  { lineId: "c", label: "Line 3" },
];

const cfg = (segments: QuestionVideoConfig["segments"]): QuestionVideoConfig => ({
  videoPath: "p.mp4",
  duration: 255.64,
  checkpoints: {},
  segments,
  introEnabled: true,
  conclusionEnabled: true,
});

describe("no chaining between sections", () => {
  it("keeps a written range exactly as written", () => {
    const sections = sectionsFor(
      lines,
      cfg([
        { key: "intro", start: 0, end: 17.63 },
        { key: "line:a", start: 18.63, end: 40.4 },
        { key: "line:b", start: 60, end: 88.7 },
      ]),
    );
    expect(sections.map((s) => [s.key, s.startAt, s.endAt])).toEqual([
      ["intro", 0, 17.63],
      ["line:a", 18.63, 40.4],
      ["line:b", 60, 88.7],
      ["line:c", null, null],
      ["conclusion", null, null],
    ]);
  });

  it("adopts a legacy end-only record", () => {
    const sections = sectionsFor(lines, {
      ...cfg([]),
      checkpoints: { intro: 30, "line:a": 75, "line:b": 123 },
    });
    expect(sections.map((s) => [s.key, s.startAt, s.endAt])).toEqual([
      ["intro", 0, 30],
      ["line:a", 30, 75],
      ["line:b", 75, 123],
      ["line:c", null, null],
      ["conclusion", null, null],
    ]);
  });

  it("flags only a range that ends before it starts", () => {
    expect(emptySectionsFor(sectionsFor(lines, cfg([{ key: "line:a", start: 40, end: 20 }])))).toEqual(["line:a"]);
    expect(emptySectionsFor(sectionsFor(lines, cfg([{ key: "line:a", start: 20, end: 40 }])))).toEqual([]);
    // An unset section is not an error — it simply has no video yet.
    expect(emptySectionsFor(sectionsFor(lines, cfg([])))).toEqual([]);
  });
});
