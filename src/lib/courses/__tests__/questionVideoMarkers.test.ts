// The timeline law: gaps and overlaps are the teacher's choice, an unset
// boundary is not 0:00, and a range never leaks to another line.
import { describe, expect, it } from "vitest";
import {
  emptyVideoConfig,
  lineKey,
  overlapsFor,
  sectionForLine,
  sectionsFor,
  writeBoundary,
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
  it("allows a gap between two sections", () => {
    const sections = sectionsFor(
      lines,
      cfg([
        { key: lineKey("a"), start: 0, end: 31 },
        { key: lineKey("b"), start: 45, end: 80 },
      ]),
    );
    expect(sections[0]!.endAt).toBe(31);
    expect(sections[1]!.startAt).toBe(45);
  });

  it("allows an overlap and only reports it as information", () => {
    const sections = sectionsFor(
      lines,
      cfg([
        { key: lineKey("a"), start: 0, end: 60 },
        { key: lineKey("b"), start: 50, end: 90 },
      ]),
    );
    expect(sections[1]!.startAt).toBe(50);
    expect(overlapsFor(sections)).toContain(lineKey("b"));
  });

  it("never reports an overlap for unset sections", () => {
    expect(overlapsFor(sectionsFor(lines, cfg([])))).toEqual([]);
  });

  it("marking a later section does not move earlier ones", () => {
    const base = cfg([{ key: lineKey("a"), start: 5, end: 40 }]);
    const next = { ...base, segments: writeBoundary(sectionsFor(lines, base), lineKey("c"), "end", 250) };
    const sections = sectionsFor(lines, next);
    expect([sections[0]!.startAt, sections[0]!.endAt]).toEqual([5, 40]);
    expect(sections[2]!.endAt).toBe(250);
  });

  it("keeps every range attached to its own line", () => {
    const sections = sectionsFor(
      lines,
      cfg([
        { key: lineKey("c"), start: 200, end: 250 },
        { key: lineKey("a"), start: 0, end: 20 },
      ]),
    );
    expect(sectionForLine(sections, "b")?.startAt).toBeNull();
    expect(sectionForLine(sections, "c")?.startAt).toBe(200);
    expect(sectionForLine(sections, "a")?.endAt).toBe(20);
  });
});
