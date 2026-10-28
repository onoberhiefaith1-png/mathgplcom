// STAB-002 — the layout guard may never occupy the main thread. Its
// self-triggered passes are bounded, and the budget only comes back after a
// quiet window (or a real teacher edit, which resets the counter directly).
import { describe, expect, it } from "vitest";
import { BURST_RESET_MS, MAX_PASSES, layoutPassBudget } from "@/lib/lessonnotes/sessionLayout";

describe("layout pass budget (STAB-002)", () => {
  it("allows a bounded burst of passes", () => {
    const now = 10_000;
    for (let p = 0; p < MAX_PASSES; p++) {
      expect(layoutPassBudget(p, now, now).run).toBe(true);
    }
  });

  it("stops rescheduling once the burst budget is spent", () => {
    const now = 10_000;
    expect(layoutPassBudget(MAX_PASSES, now, now).run).toBe(false);
    expect(layoutPassBudget(MAX_PASSES + 20, now, now).run).toBe(false);
  });

  it("cannot loop forever: a spent budget stays spent inside the burst window", () => {
    let passes = 0;
    let last = 0;
    let ran = 0;
    for (let i = 0; i < 500; i++) {
      const now = last + 1; // relentless self-triggering, no quiet window
      const b = layoutPassBudget(passes, last, now);
      passes = b.passes;
      if (!b.run) continue;
      passes += 1;
      last = now;
      ran += 1;
    }
    expect(ran).toBe(MAX_PASSES);
  });

  it("restores the budget after the quiet window", () => {
    const b = layoutPassBudget(MAX_PASSES, 0, BURST_RESET_MS + 1);
    expect(b.run).toBe(true);
    expect(b.passes).toBe(0);
  });
});
