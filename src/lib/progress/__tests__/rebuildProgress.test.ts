import { describe, expect, it } from "vitest";
import {
  bandValue, buildPercent, easedFraction, monotonic, stagePercent,
} from "../rebuildProgress";

describe("rebuild progress", () => {
  it("eases gradually and never reaches the ceiling by time alone", () => {
    expect(easedFraction(0, 10_000)).toBe(0);
    const a = easedFraction(5_000, 10_000);
    const b = easedFraction(20_000, 10_000);
    const c = easedFraction(10_000_000, 10_000);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeLessThanOrEqual(0.95);
  });

  it("keeps a band value inside its band", () => {
    expect(bandValue([10, 40], 0, 1000)).toBe(10);
    expect(bandValue([10, 40], 1e9, 1000)).toBeLessThan(40);
  });

  it("counts finished items fully and the running item by phase", () => {
    const now = 100_000;
    const items = [{ state: "done" }, { state: "running" }, { state: "pending" }, { state: "pending" }];
    const q = buildPercent(items, { phase: "question", startedAt: now }, now);
    const s = buildPercent(items, { phase: "solution", startedAt: now }, now);
    const sLate = buildPercent(items, { phase: "solution", startedAt: now - 60_000 }, now);
    expect(q).toBe(25);
    expect(s).toBeGreaterThan(q);
    expect(sLate).toBeGreaterThan(s);
    expect(sLate).toBeLessThan(50); // never claims the next item early
  });

  it("only reports 100% when every item is settled", () => {
    const now = 1;
    expect(buildPercent([{ state: "done" }, { state: "running" }], { phase: "solution", startedAt: -1e9 }, now)).toBeLessThanOrEqual(99);
    expect(buildPercent([{ state: "done" }, { state: "skipped" }], null, now)).toBe(100);
  });

  it("maps pipeline stages to rising bands", () => {
    expect(stagePercent("ANALYSING", 0)).toBe(10);
    expect(stagePercent("GENERATING_SOLUTION", 60_000)).toBeGreaterThan(stagePercent("GENERATING_SOLUTION", 1_000));
    expect(stagePercent("READY", 0)).toBe(100);
  });

  it("never moves backwards", () => {
    expect(monotonic(null, 12)).toBe(12);
    expect(monotonic(40, 30)).toBe(40);
  });
});
