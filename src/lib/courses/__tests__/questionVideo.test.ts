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
  writeBoundary,
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
  it("makes one section per mathematical line, all unset by default", () => {
    const s = sectionsFor(lines, cfg());
    expect(s).toHaveLength(8);
    expect(s.every((x) => x.startAt === null && x.endAt === null)).toBe(true);
    expect(s.every((x) => x.configured === false)).toBe(true);
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
  });

  it("adopts a legacy end-only record as explicit ranges", () => {
    const s = sectionsFor(lines, cfg({ checkpoints: { [lineKey("L1")]: 35, [lineKey("L2")]: 70 } }));
    expect([s[0].startAt, s[0].endAt]).toEqual([0, 35]);
    expect([s[1].startAt, s[1].endAt]).toEqual([35, 70]);
    expect(s[2].configured).toBe(false);
  });

  it("keeps each section's own values with no chaining or clamping", () => {
    const s = sectionsFor(
      lines,
      cfg({
        segments: [
          { key: lineKey("L1"), start: 0, end: 31 },
          { key: lineKey("L2"), start: 45, end: 90 },
        ],
      }),
    );
    expect([s[0].startAt, s[0].endAt]).toEqual([0, 31]);
    expect([s[1].startAt, s[1].endAt]).toEqual([45, 90]);
    expect(s[2].startAt).toBeNull();
  });

  it("returns nothing without lines", () => {
    expect(sectionsFor([], cfg())).toHaveLength(0);
  });
});

describe("writeBoundary", () => {
  it("prepares the next start one second after a confirmed end", () => {
    const s = sectionsFor(lines, cfg());
    const markers = writeBoundary(s, lineKey("L1"), "end", 31);
    expect(markers[0]).toMatchObject({ key: lineKey("L1"), end: 31 });
    expect(markers[1]).toMatchObject({ key: lineKey("L2"), start: 32, startSource: "auto", end: null });
  });

  it("respects a manually edited start and leaves the previous end alone", () => {
    let conf = cfg();
    conf = { ...conf, segments: writeBoundary(sectionsFor(lines, conf), lineKey("L1"), "end", 75) };
    conf = { ...conf, segments: writeBoundary(sectionsFor(lines, conf), lineKey("L2"), "start", 90) };
    conf = { ...conf, segments: writeBoundary(sectionsFor(lines, conf), lineKey("L2"), "end", 120) };
    const s = sectionsFor(lines, conf);
    expect(s[0].endAt).toBe(75);
    expect(s[1].startAt).toBe(90);
    expect(s[1].startSource).toBe("manual");
    expect(s[2].startAt).toBe(121);
  });

  it("clears a boundary back to unset", () => {
    const conf = { ...cfg(), segments: writeBoundary(sectionsFor(lines, cfg()), lineKey("L3"), "end", 10) };
    const cleared = writeBoundary(sectionsFor(lines, conf), lineKey("L3"), "end", null);
    expect(cleared.find((m) => m.key === lineKey("L3"))?.end).toBeNull();
  });
});

describe("navigation", () => {
  it("resolves a line's own section by identity", () => {
    const s = sectionsFor(lines, cfg({ introEnabled: true }));
    expect(sectionForLine(s, "L7")?.key).toBe(lineKey("L7"));
  });

  it("video next/previous only move within the section list", () => {
    const s = sectionsFor(lines, cfg());
    expect(nextSection(s, lineKey("L1"))?.lineId).toBe("L2");
    expect(prevSection(s, lineKey("L2"))?.lineId).toBe("L1");
    expect(prevSection(s, lineKey("L1"))).toBeNull();
    expect(nextSection(s, lineKey("L8"))).toBeNull();
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
