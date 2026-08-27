import { describe, expect, it } from "vitest";
import {
  emptyVideoConfig,
  lineKey,
  overlapsFor,
  sectionForLine,
  sectionsFor,
  type QuestionVideoConfig,
  type VideoLine,
} from "@/lib/courses/questionVideo";

const lines: VideoLine[] = [
  { lineId: "a", label: "Line 1" },
  { lineId: "b", label: "Line 2" },
  { lineId: "c", label: "Line 3" },
];

const cfg = (segments: QuestionVideoConfig["segments"]): QuestionVideoConfig => ({
  ...emptyVideoConfig(),
  videoPath: "v.mp4",
  duration: 300,
  segments,
});

describe("teaching-video markers", () => {
  it("keeps a boundary that precedes the previous section's end", () => {
    const sections = sectionsFor(
      lines,
      cfg([
        { key: lineKey("a"), start: 10, end: 120 },
        { key: lineKey("b"), start: 70, end: 100 },
      ]),
    );
    const b = sections.find((s) => s.key === lineKey("b"))!;
    expect(b.start).toBe(70);
    expect(b.end).toBe(100);
  });

  it("marking a later section does not move earlier ones", () => {
    const sections = sectionsFor(
      lines,
      cfg([
        { key: lineKey("a"), start: 5, end: 40 },
        { key: lineKey("c"), start: 200, end: 250 },
      ]),
    );
    const a = sections.find((s) => s.key === lineKey("a"))!;
    expect(a.start).toBe(5);
    expect(a.end).toBe(40);
  });

  it("never lets end precede its own start", () => {
    const [a] = sectionsFor(lines, cfg([{ key: lineKey("a"), start: 90, end: 30 }]));
    expect(a!.end).toBeGreaterThanOrEqual(a!.start);
  });

  it("flags a backwards / overlapping pair", () => {
    const sections = sectionsFor(
      lines,
      cfg([
        { key: lineKey("a"), start: 0, end: 120 },
        { key: lineKey("b"), start: 60, end: 130 },
      ]),
    );
    expect(overlapsFor(sections)).toContain(lineKey("b"));
  });

  it("falls back to even slices and still resolves a line's slice", () => {
    const sections = sectionsFor(lines, cfg([]));
    expect(sections).toHaveLength(3);
    expect(sections[0]!.end).toBeCloseTo(100);
    expect(sectionForLine(sections, "b")?.key).toBe(lineKey("b"));
  });
});
