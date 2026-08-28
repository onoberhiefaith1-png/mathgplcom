// The exact acceptance scenario from the Speed Builder timeline fix.
import { describe, expect, it } from "vitest";
import {
  emptyVideoConfig,
  lineKey,
  sectionsFor,
  writeBoundary,
  type QuestionVideoConfig,
  type VideoLine,
} from "../questionVideo";

const lines: VideoLine[] = Array.from({ length: 5 }, (_, i) => ({
  lineId: `l${i + 1}`,
  label: `Line ${i + 1}`,
}));

const start = (): QuestionVideoConfig => ({
  ...emptyVideoConfig(),
  videoPath: "v.mp4",
  duration: 600,
  introEnabled: true,
});

const write = (
  cfg: QuestionVideoConfig,
  key: string,
  field: "start" | "end",
  seconds: number,
): QuestionVideoConfig => ({ ...cfg, segments: writeBoundary(sectionsFor(lines, cfg), key, field, seconds) });

describe("acceptance: intro + five lines on a 10-minute video", () => {
  it("prepares each next start, honours a manual edit, and never disturbs a neighbour", () => {
    let cfg = start();

    // Introduction 00:00 → 00:30
    cfg = write(cfg, "intro", "start", 0);
    cfg = write(cfg, "intro", "end", 30);
    expect(sectionsFor(lines, cfg).find((s) => s.key === lineKey("l1"))?.startAt).toBe(31);

    // Line 1 ends at 01:15 → Line 2 prepared at 01:16
    cfg = write(cfg, lineKey("l1"), "end", 75);
    let s = sectionsFor(lines, cfg);
    expect(s.find((x) => x.key === lineKey("l1"))).toMatchObject({ startAt: 31, endAt: 75, configured: true });
    expect(s.find((x) => x.key === lineKey("l2"))).toMatchObject({ startAt: 76, endAt: null, startSource: "auto" });

    // Manual edit of Line 2's start to 01:30 leaves Line 1's end at 01:15
    cfg = write(cfg, lineKey("l2"), "start", 90);
    s = sectionsFor(lines, cfg);
    expect(s.find((x) => x.key === lineKey("l1"))?.endAt).toBe(75);
    expect(s.find((x) => x.key === lineKey("l2"))).toMatchObject({ startAt: 90, startSource: "manual" });

    // Lines 3-5 are untouched and still explicitly unset
    for (const id of ["l3", "l4", "l5"]) {
      expect(s.find((x) => x.lineId === id)).toMatchObject({ startAt: null, endAt: null, configured: false });
    }

    // Configuring Line 4 cannot make its values appear under Line 2
    cfg = write(cfg, lineKey("l4"), "start", 300);
    cfg = write(cfg, lineKey("l4"), "end", 330);
    s = sectionsFor(lines, cfg);
    expect(s.find((x) => x.lineId === "l2")?.endAt).toBeNull();
    expect(s.find((x) => x.lineId === "l4")).toMatchObject({ startAt: 300, endAt: 330 });
    expect(s.find((x) => x.lineId === "l5")?.startAt).toBe(331);
    expect(s.find((x) => x.lineId === "l3")).toMatchObject({ startAt: null, endAt: null });
  });
});
