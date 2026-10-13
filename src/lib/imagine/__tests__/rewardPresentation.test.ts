import { describe, expect, it } from "vitest";
import { createBatchedConsumer, createRewardPresentationGuard } from "../rewardPresentation";

describe("reward presentation guard", () => {
  it("plays a live reward only once, so chains cannot loop", () => {
    const g = createRewardPresentationGuard();
    expect(g.admit("r1", false)).toBe(true);
    expect(g.admit("r1", false)).toBe(false);
  });
  it("editor previews always play", () => {
    const g = createRewardPresentationGuard();
    g.admit("r1", false);
    expect(g.admit("r1", true)).toBe(true);
  });
});

describe("batched consumer", () => {
  it("flushes many consumes in one scheduled pass", () => {
    const flushes: Array<() => void> = [];
    const seen: string[] = [];
    const c = createBatchedConsumer((s, r) => seen.push(`${s}:${r}`), (f) => flushes.push(f));
    c("a", "1"); c("a", "2"); c("b", "3");
    expect(flushes).toHaveLength(1);
    expect(seen).toEqual([]);
    flushes[0]();
    expect(seen).toEqual(["a:1", "a:2", "b:3"]);
  });
  it("one failing consume does not stop the others", () => {
    const seen: string[] = [];
    const c = createBatchedConsumer((_s, r) => { if (r === "bad") throw new Error("x"); seen.push(r); }, (f) => f());
    c("a", "bad");
    c("a", "ok");
    expect(seen).toEqual(["ok"]);
  });
});
