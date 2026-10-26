import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canOfferStart, planPreload, retryOnce, runPool, runStagedPreload, withDeadline, withTimeout, type PreloadJob } from "../adventurePreload";

const job = (key: string, kind: PreloadJob["kind"], at?: number, run: () => Promise<unknown> = async () => null): PreloadJob => ({ key, kind, at, run });

describe("planPreload", () => {
  it("makes the music and the first narrator clips essential, the rest lazy in video order", () => {
    const jobs = [job("n3", "narration", 30), job("m", "music"), job("n1", "narration", 5), job("s", "sound"), job("n2", "narration", 12)];
    const { essential, lazy } = planPreload(jobs, 2);
    expect(essential.map((j) => j.key)).toEqual(["m", "n1", "n2"]);
    expect(lazy.map((j) => j.key)).toEqual(["s", "n3"]);
  });
  it("copes with no jobs", () => expect(planPreload([])).toEqual({ essential: [], lazy: [] }));
});

describe("timeouts and retries", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("withTimeout falls back when the work hangs and when it fails", async () => {
    const hung = withTimeout(new Promise<string>(() => {}), 1000, "late");
    await vi.advanceTimersByTimeAsync(1000);
    expect(await hung).toBe("late");
    expect(await withTimeout(Promise.reject(new Error("x")), 1000, "fb")).toBe("fb");
    expect(await withTimeout(Promise.resolve("ok"), 1000, "fb")).toBe("ok");
  });
  it("retryOnce tries a second time after a throw or a failure marker", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("no")).mockResolvedValueOnce("yes");
    expect(await retryOnce(fn)).toBe("yes");
    expect(fn).toHaveBeenCalledTimes(2);
    const marker = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce("v");
    expect(await retryOnce(marker, (v) => v === null)).toBe("v");
    const ok = vi.fn().mockResolvedValue("fine");
    await retryOnce(ok);
    expect(ok).toHaveBeenCalledTimes(1);
  });
  it("withDeadline rejects with a readable message after the limit, once retried", async () => {
    const fn = vi.fn(() => new Promise<string>(() => {}));
    const p = withDeadline(fn, 500, "Loading the Game");
    const caught = p.catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(1100);
    expect(await caught).toContain("Loading the Game is taking too long");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("runPool", () => {
  it("never runs more than `limit` at once and survives a failing worker", async () => {
    let live = 0; let peak = 0;
    await runPool([1, 2, 3, 4, 5, 6], 2, async (n) => {
      live++; peak = Math.max(peak, live);
      await Promise.resolve();
      live--;
      if (n === 3) throw new Error("boom");
    });
    expect(peak).toBeLessThanOrEqual(2);
  });
});

describe("runStagedPreload", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("is ready once the essential jobs finish even though lazy jobs are still going", async () => {
    const order: string[] = [];
    let release: () => void = () => {};
    const slow = new Promise<void>((r) => { release = r; });
    const jobs = [
      job("m", "music", undefined, async () => { order.push("m"); }),
      job("n1", "narration", 1, async () => { order.push("n1"); }),
      job("n9", "narration", 90, async () => { await slow; order.push("n9"); }),
    ];
    const progress: number[] = [];
    const { ready, all } = runStagedPreload(jobs, { essentialCapMs: 6000, perJobMs: 15000, firstClips: 1, onProgress: (p) => progress.push(p.done) });
    await ready;
    expect(order).toEqual(["m", "n1"]);
    expect(progress.at(-1)).toBe(2);
    release();
    await all;
    expect(order).toEqual(["m", "n1", "n9"]);
  });
  it("offers Start after the cap when an essential download hangs, and never waits on it forever", async () => {
    const jobs = [job("m", "music", undefined, () => new Promise(() => {}))];
    const { ready } = runStagedPreload(jobs, { essentialCapMs: 6000, perJobMs: 15000 });
    let resolved = false;
    void ready.then(() => { resolved = true; });
    await vi.advanceTimersByTimeAsync(5900);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(resolved).toBe(true);
  });
  it("is ready immediately with nothing to download", async () => {
    const { ready } = runStagedPreload([], { essentialCapMs: 6000, perJobMs: 1000 });
    await expect(ready).resolves.toBeUndefined();
  });
  it("stops starting new jobs once cancelled", async () => {
    const run = vi.fn(async () => null);
    let cancelled = false;
    const { all } = runStagedPreload([job("m", "music", undefined, async () => { cancelled = true; }), job("a", "narration", 1, run), job("b", "narration", 2, run)], { essentialCapMs: 100, perJobMs: 100, concurrency: 1, firstClips: 0, isCancelled: () => cancelled });
    await all;
    expect(run).not.toHaveBeenCalled();
  });
});

describe("canOfferStart", () => {
  const base = { dataReady: true, essentialReady: true, videoLoaded: true, waitedMs: 0 };
  it("needs data, first assets and the video — or the video cap", () => {
    expect(canOfferStart(base)).toBe(true);
    expect(canOfferStart({ ...base, dataReady: false })).toBe(false);
    expect(canOfferStart({ ...base, essentialReady: false })).toBe(false);
    expect(canOfferStart({ ...base, videoLoaded: false, waitedMs: 5999 })).toBe(false);
    expect(canOfferStart({ ...base, videoLoaded: false, waitedMs: 6000 })).toBe(true);
  });
});
