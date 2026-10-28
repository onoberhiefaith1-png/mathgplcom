import { describe, expect, it } from "vitest";
import {
  clockExpired, designedBarsOf, effectiveClock, nextGameClock, pointDue, pointTimeSeconds, showTimeBar, startPointClock, timeLeftFraction,
} from "../adventurePlay";

const pts = [
  { id: "p1", loopStart: 10, loopEnd: 20 },
  { id: "p2", loopStart: 40, loopEnd: 50 },
];

describe("pointDue — a learning point is never skipped", () => {
  it("is null before the first point", () => expect(pointDue(pts, 9.9, new Set())).toBeNull());
  it("enters inside the loop", () => expect(pointDue(pts, 12, new Set())?.id).toBe("p1"));
  it("catches a point the playhead already jumped past", () => expect(pointDue(pts, 31, new Set())?.id).toBe("p1"));
  it("catches a point the playhead ran past the END of", () => expect(pointDue(pts, 45, new Set(["p1"]))?.id).toBe("p2"));
  it("skips finished points and returns null when all are done", () => {
    expect(pointDue(pts, 12, new Set(["p1"]))).toBeNull();
    expect(pointDue(pts, 99, new Set(["p1", "p2"]))).toBeNull();
  });
  it("ignores points without a loop and non-finite times", () => {
    expect(pointDue([{ id: "x" }], 5, new Set())).toBeNull();
    expect(pointDue(pts, Number.NaN, new Set())).toBeNull();
  });
});

describe("learning-point clock", () => {
  it("designed time bar seconds win, then the older per-point timer, else none", () => {
    expect(pointTimeSeconds({ timerEnabled: true, timeLimit: 90 }, 45)).toBe(45);
    expect(pointTimeSeconds({ timerEnabled: true, timeLimit: 90 }, 0)).toBe(90);
    expect(pointTimeSeconds({ timerEnabled: true }, 0)).toBe(300);
    expect(pointTimeSeconds({ timerEnabled: false, timeLimit: 90 }, 0)).toBe(0);
    expect(pointTimeSeconds(null, 30)).toBe(0);
  });
  it("starts a countdown only when there are seconds", () => {
    expect(startPointClock(0, 1000)).toBeNull();
    expect(startPointClock(30, 1000)).toEqual({ start: 1000, deadline: 31000 });
  });
  it("the Game's question timer wins; a bonus extension keeps the original start; clearing drops it", () => {
    const own = { start: 0, deadline: 10 };
    const point = { start: 0, deadline: 300 };
    expect(effectiveClock(own, point)).toBe(own);
    expect(effectiveClock(null, point)).toBe(point);
    expect(effectiveClock(null, null)).toBeNull();
    expect(nextGameClock(null, 5000, 1000)).toEqual({ start: 1000, deadline: 5000 });
    expect(nextGameClock({ start: 1000, deadline: 5000 }, 9000, 2000)).toEqual({ start: 1000, deadline: 9000 });
    expect(nextGameClock({ start: 1000, deadline: 5000 }, null, 2000)).toBeNull();
  });
  it("reports time left and expiry", () => {
    const c = { start: 1000, deadline: 2000 };
    expect(timeLeftFraction(c, 1250)).toBeCloseTo(0.75);
    expect(timeLeftFraction(c, 5000)).toBe(0);
    expect(timeLeftFraction(null, 5)).toBe(0);
    expect(clockExpired(c, 1999)).toBe(false);
    expect(clockExpired(c, 2000)).toBe(true);
    expect(clockExpired(null, 1000)).toBe(false);
  });
  it("shows the time bar whenever a clock runs unless the teacher hid it", () => {
    const c = { start: 0, deadline: 10 };
    expect(showTimeBar(c, undefined)).toBe(true);
    expect(showTimeBar(c, true)).toBe(true);
    expect(showTimeBar(c, false)).toBe(false);
    expect(showTimeBar(null, true)).toBe(false);
  });
});

describe("designedBarsOf — same roles as the Adventure editor", () => {
  const bar = (id: string, role?: string) => ({ id, kind: "progress_bar", progress: { role } });
  it("explicit roles", () => {
    const r = designedBarsOf([bar("l", "learning"), bar("t", "time")]);
    expect(r.time?.id).toBe("t");
    expect(r.learning?.id).toBe("l");
  });
  it("legacy bars with no role: the FIRST is the clock, the next is the learning bar", () => {
    const r = designedBarsOf([bar("a"), bar("b")]);
    expect(r.time?.id).toBe("a");
    expect(r.learning?.id).toBe("b");
  });
  it("a single legacy bar is the clock, so the learning bar falls back to the default", () => {
    const r = designedBarsOf([bar("a")]);
    expect(r.time?.id).toBe("a");
    expect(r.learning).toBeNull();
  });
  it("ignores other elements and bars without a design; tolerates no elements", () => {
    expect(designedBarsOf([{ id: "img", kind: "image" }, { id: "b", kind: "progress_bar" }])).toEqual({ time: null, learning: null });
    expect(designedBarsOf(undefined)).toEqual({ time: null, learning: null });
  });
});
