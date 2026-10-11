import { describe, expect, it, vi } from "vitest";
import { HARD_DEADLINE_MS, READY_KEY, readyPercent, verifiedCatalogue, withDeadline } from "../getReady";

describe("offline Get ready", () => {
  it("ignores half-finished downloads from the old version", () => {
    expect(READY_KEY).toBe("readyAt.v5");
  });
  it("never takes longer than one minute", () => {
    expect(HARD_DEADLINE_MS).toBeLessThanOrEqual(60_000);
  });
  it("gives up on a slow file at the deadline instead of waiting", async () => {
    vi.useFakeTimers();
    const p = withDeadline(new Promise<string>(() => {}), 1000, "skipped");
    vi.advanceTimersByTime(1000);
    await expect(p).resolves.toBe("skipped");
    vi.useRealTimers();
  });
  it("treats a failed file as skipped, not as a crash", async () => {
    await expect(withDeadline(Promise.reject(new Error("x")), 1000, "skipped")).resolves.toBe("skipped");
  });
  it("is ready only when the saved content reads back", () => {
    const cat = { schools: [{ id: "a" }] } as never;
    expect(verifiedCatalogue(undefined, cat)).toBe(false);
    expect(verifiedCatalogue({ schools: [] } as never, cat)).toBe(false);
    expect(verifiedCatalogue(cat, cat)).toBe(true);
  });
  it("reaches 100 only when finished", () => {
    expect(readyPercent("media", 10, 10)).toBeLessThan(100);
    expect(readyPercent("done")).toBe(100);
  });
});
