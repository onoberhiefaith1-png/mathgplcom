import { describe, expect, it } from "vitest";
import {
  emptyVideoConfig,
  lineKey,
  nextSection,
  prevSection,
  sectionForLine,
  sectionsFor,
  shouldAutoPlay,
  videoReady,
  type QuestionVideoConfig,
} from "../questionVideo";

const lines = Array.from({ length: 8 }, (_, i) => ({ lineId: `L${i + 1}`, label: `Line ${i + 1}` }));

const cfg = (over: Partial<QuestionVideoConfig> = {}): QuestionVideoConfig => ({
  ...emptyVideoConfig(),
  videoPath: "u/1/v.mp4",
  duration: 800,
  ...over,
});

describe("sectionsFor", () => {
  it("makes one section per mathematical line, evenly split by default", () => {
    const s = sectionsFor(lines, cfg());
    expect(s).toHaveLength(8);
    expect(s[0].start).toBe(0);
    expect(s[0].end).toBe(100);
    expect(s[7].end).toBe(800);
    expect(s.every((x) => x.required)).toBe(true);
  });

  it("adds optional intro and conclusion only when enabled", () => {
    const off = sectionsFor(lines, cfg());
    expect(off.map((s) => s.key)).not.toContain("intro");
    const on = sectionsFor(lines, cfg({ introEnabled: true, conclusionEnabled: true }));
    expect(on).toHaveLength(10);
    expect(on[0].key).toBe("intro");
    expect(on[0].required).toBe(false);
    expect(on[9].key).toBe("conclusion");
    expect(on[9].end).toBe(800);
  });

  it("each section starts at the previous checkpoint", () => {
    const s = sectionsFor(lines, cfg({ checkpoints: { [lineKey("L1")]: 35, [lineKey("L2")]: 70 } }));
    expect(s[0].end).toBe(35);
    expect(s[1].start).toBe(35);
    expect(s[1].end).toBe(70);
    expect(s[2].start).toBe(70);
  });

  it("clamps out-of-order and out-of-range checkpoints", () => {
    const s = sectionsFor(lines, cfg({ checkpoints: { [lineKey("L1")]: 120, [lineKey("L2")]: 40, [lineKey("L3")]: 9999 } }));
    expect(s[0].end).toBe(120);
    expect(s[1].end).toBe(120); // never before the previous checkpoint
    expect(s[2].end).toBe(800); // never past the end of the video
    for (let i = 1; i < s.length; i++) expect(s[i].start).toBeGreaterThanOrEqual(s[i - 1].start);
  });

  it("returns nothing without a duration or lines", () => {
    expect(sectionsFor([], cfg())).toHaveLength(0);
    const s = sectionsFor(lines, cfg({ duration: 0 }));
    expect(s.every((x) => x.start === 0 && x.end === 0)).toBe(true);
  });
});

describe("navigation", () => {
  it("jumps straight to a skipped line's section", () => {
    const s = sectionsFor(lines, cfg({ introEnabled: true }));
    const seven = sectionForLine(s, "L7");
    expect(seven?.key).toBe(lineKey("L7"));
    expect(seven?.start).toBe(s[6].end);
  });

  it("video next/previous only move within the section list", () => {
    const s = sectionsFor(lines, cfg());
    expect(nextSection(s, lineKey("L1"))?.lineId).toBe("L2");
    expect(prevSection(s, lineKey("L2"))?.lineId).toBe("L1");
    expect(prevSection(s, lineKey("L1"))).toBeNull();
    expect(nextSection(s, lineKey("L8"))).toBeNull();
    // pure: the section list is untouched by navigation
    expect(sectionsFor(lines, cfg())).toEqual(s);
  });

  it("does not replay a completed line but replays an unfinished one", () => {
    expect(shouldAutoPlay({ lineCompleted: true })).toBe(false);
    expect(shouldAutoPlay({ lineCompleted: false })).toBe(true);
  });
});

describe("videoReady", () => {
  it("needs a file and a duration", () => {
    expect(videoReady(null)).toBe(false);
    expect(videoReady(cfg({ videoPath: null }))).toBe(false);
    expect(videoReady(cfg({ duration: 0 }))).toBe(false);
    expect(videoReady(cfg())).toBe(true);
  });
});
