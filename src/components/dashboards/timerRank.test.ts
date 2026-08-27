import { describe, it, expect } from "vitest";
import { rankByTime } from "@/components/dashboards/AssignmentTimerPanel";
import { formatAttemptTime } from "@/hooks/useQuestionTimerAttempt";

describe("timer attempt ranking", () => {
  it("shares positions on exact ties", () => {
    const r = rankByTime([{ ms: 5000 }, { ms: 3000 }, { ms: 3000 }, { ms: 9000 }]);
    expect(r.map((x) => x.place)).toEqual([1, 1, 3, 4]);
  });
  it("breaks ties on milliseconds", () => {
    const r = rankByTime([{ ms: 3001 }, { ms: 3000 }]);
    expect(r.map((x) => x.place)).toEqual([1, 2]);
  });
  it("formats past 24 hours", () => {
    expect(formatAttemptTime(0)).toBe("00:00:00");
    expect(formatAttemptTime(90061000)).toBe("25:01:01");
  });
});
