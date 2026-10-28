import { describe, expect, it } from "vitest";
import { summariseAttempts } from "@/lib/offline/results";
import { markLine } from "@/lib/offline/marking";
import type { LocalAttempt } from "@/lib/offline/academiaStore";

const att = (score: number, at: string): LocalAttempt => ({
  id: at, activityId: "a1", sessionId: "s1", mode: "practice", score, maxScore: 6, at, synced: false,
});

describe("offline Academia results", () => {
  it("keeps best and latest scores per activity", () => {
    const s = summariseAttempts([att(4, "2026-10-01"), att(6, "2026-10-02"), att(2, "2026-10-03")]).get("a1")!;
    expect(s.best).toBe(6);
    expect(s.latest).toBe(2);
    expect(s.attempts).toBe(3);
  });
  it("marks a complete equivalent line immediately", () => {
    expect(markLine("x + 7 = 15", "x+7=15")).toBe(true);
  });
  it("gives no mark to a one-sided fragment", () => {
    expect(markLine("x + 7 = 15", "x + 7")).toBe(false);
  });
});
