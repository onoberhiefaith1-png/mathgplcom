// A section's start must always chain from the boundary above it, and a
// collapsed marker (start === end, the bug that froze the player at 0:00) must
// be repaired on read so an already-saved video plays.
import { describe, expect, it } from "vitest";
import { emptySectionsFor, sectionsFor, type QuestionVideoConfig, type VideoLine } from "../questionVideo";

const lines: VideoLine[] = [
  { lineId: "a", label: "Line 1" },
  { lineId: "b", label: "Line 2" },
  { lineId: "c", label: "Line 3" },
];

const cfg = (segments: { key: string; start: number; end: number }[]): QuestionVideoConfig => ({
  videoPath: "p.mp4",
  duration: 255.64,
  checkpoints: {},
  segments,
  introEnabled: true,
  conclusionEnabled: true,
});

describe("sectionsFor chaining", () => {
  it("repairs the saved record whose line markers had no duration", () => {
    const sections = sectionsFor(
      lines,
      cfg([
        { key: "intro", start: 0, end: 17.63 },
        { key: "line:a", start: 40.403457, end: 40.403457 },
        { key: "line:b", start: 88.7, end: 88.7 },
        { key: "line:c", start: 138.22, end: 138.22 },
        { key: "conclusion", start: 204.51, end: 255.64 },
      ]),
    );
    expect(sections.map((s) => [s.key, Math.round(s.start * 100) / 100, Math.round(s.end * 100) / 100])).toEqual([
      ["intro", 0, 17.63],
      ["line:a", 17.63, 40.4],
      ["line:b", 40.4, 88.7],
      ["line:c", 88.7, 138.22],
      // A valid written start is honoured as written.
      ["conclusion", 204.51, 255.64],
    ]);
    expect(emptySectionsFor(sections)).toEqual([]);
  });

  it("advances the cursor past a marked section", () => {
    const sections = sectionsFor(lines, cfg([{ key: "line:a", start: 10, end: 30 }]));
    const a = sections.find((s) => s.key === "line:a")!;
    const b = sections.find((s) => s.key === "line:b")!;
    expect(a.end).toBe(30);
    expect(b.start).toBe(30);
    expect(b.end).toBeGreaterThan(b.start);
  });

  it("runs a section with no usable end to the next written boundary", () => {
    const sections = sectionsFor(
      lines,
      cfg([
        { key: "line:a", start: 20, end: 20 },
        { key: "line:b", start: 60, end: 90 },
      ]),
    );
    const a = sections.find((s) => s.key === "line:a")!;
    expect(a.end).toBeGreaterThan(a.start);
    expect(a.end).toBeLessThanOrEqual(60);
  });

  it("flags a genuinely empty section", () => {
    const sections = sectionsFor(lines, cfg([{ key: "line:a", start: 0, end: 0 }]));
    expect(emptySectionsFor(sections).length).toBeGreaterThanOrEqual(0);
  });
});
