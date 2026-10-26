import { describe, expect, it } from "vitest";
import { bufferedAhead, isBuffered, isPlayable, loopAction, MIN_WRAP_GAP_MS, needsSeek, stallStep, STALL_RECOVER_MS } from "../videoLoop";

const ranges = (...r: [number, number][]) => ({ length: r.length, start: (i: number) => r[i]![0], end: (i: number) => r[i]![1] });
const region = { start: 10, end: 20 };
const base = { region, seeking: false, msSinceLastSeek: 10_000 };

describe("loopAction", () => {
  it("leaves the video alone inside the region and a hair before its end", () => {
    expect(loopAction({ ...base, t: 12 })).toBe("none");
    expect(loopAction({ ...base, t: 19.97 })).toBe("none");
  });
  it("wraps once when the playhead truly crossed the end", () => {
    expect(loopAction({ ...base, t: 20 })).toBe("wrap");
    expect(loopAction({ ...base, t: 20.1 })).toBe("wrap");
  });
  it("never seeks while a seek is in flight or right after one (no double seek)", () => {
    expect(loopAction({ ...base, t: 21, seeking: true })).toBe("none");
    expect(loopAction({ ...base, t: 21, msSinceLastSeek: MIN_WRAP_GAP_MS - 1 })).toBe("none");
  });
  it("snaps in when a point opens clearly outside the region, but not for a small drift before the start", () => {
    expect(loopAction({ ...base, t: 3 })).toBe("enter");
    expect(loopAction({ ...base, t: 9.9 })).toBe("none");
  });
  it("does nothing without a region", () => {
    expect(loopAction({ ...base, region: null, t: 99 })).toBe("none");
  });
});

describe("needsSeek", () => {
  it("skips a seek to where the playhead already is (within tolerance)", () => {
    expect(needsSeek(10, 10, false)).toBe(false);
    expect(needsSeek(10.2, 10, false)).toBe(false);
    expect(needsSeek(10.4, 10, false)).toBe(true);
    expect(needsSeek(10, Number.NaN, false)).toBe(false);
  });
});

describe("readiness and buffering", () => {
  it("is playable from readyState 3 (not at metadata)", () => {
    expect(isPlayable({ readyState: 1 })).toBe(false);
    expect(isPlayable({ readyState: 2 })).toBe(false);
    expect(isPlayable({ readyState: 3 })).toBe(true);
    expect(isPlayable({ readyState: 4 })).toBe(true);
  });
  it("reads buffered ranges", () => {
    const b = ranges([0, 8], [10, 30]);
    expect(isBuffered(b, 12, 5)).toBe(true);
    expect(isBuffered(b, 8, 1)).toBe(false);
    expect(bufferedAhead(b, 12)).toBe(18);
    expect(bufferedAhead(b, 9)).toBe(0);
    expect(isBuffered(undefined, 1)).toBe(true);
  });
});

describe("stallStep", () => {
  const s = { wantPlaying: true, playable: false, paused: false, waitedMs: 0, recovering: false };
  it("waits first, then pauses a stalled picture, then resumes when it can play on", () => {
    expect(stallStep(s)).toBe("wait");
    expect(stallStep({ ...s, waitedMs: STALL_RECOVER_MS })).toBe("pause");
    expect(stallStep({ ...s, waitedMs: 9000, recovering: true, paused: true })).toBe("wait");
    expect(stallStep({ ...s, playable: true, recovering: true, paused: true })).toBe("resume");
  });
  it("does nothing when the page does not want it playing", () => {
    expect(stallStep({ ...s, wantPlaying: false, waitedMs: 99_999 })).toBe("none");
  });
});
