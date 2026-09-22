import { describe, expect, it } from "vitest";
import { appendEvent, buildLineReport, deriveMathStatus, looksIncomplete } from "../inspector";
import type { MappedLine } from "@/lib/slate/pattern";

const row = (over: Partial<MappedLine> = {}): MappedLine => ({
  line: 1,
  isQuestion: false,
  lineId: "l1",
  patternSlot: 1,
  rewards: [],
  timerSeconds: null,
  hourglassSeconds: 0,
  vaultExpression: null,
  vaultCodes: [],
  vaultCoins: 1,
  ...over,
});

const report = (over: Parameters<typeof buildLineReport>[0] extends never ? never : Partial<Parameters<typeof buildLineReport>[0]>) =>
  buildLineReport({
    row: row(),
    questionRowId: "q1",
    expected: "x + 7 = 12",
    student: "",
    note: "Subtract 7 from both sides.",
    lineMarks: 6,
    awarded: false,
    consumedRewardKeys: [],
    verdict: null,
    timedLine: null,
    hourglassToTime: 1,
    lifeToTime: 1,
    ...over,
  });

describe("mathematical status ladder", () => {
  it("reports nothing written as not started", () => {
    expect(deriveMathStatus({ isQuestion: false, expected: "x = 5", student: "", awarded: false })).toBe("not_started");
  });
  it("flags a half-written equation as incomplete", () => {
    expect(looksIncomplete("x + 7 = 12", "x + 7")).toBe(true);
    expect(looksIncomplete("x + 7 = 12", "x + 7 =")).toBe(true);
    expect(looksIncomplete("x + 7 = 12", "x + 7 = 12")).toBe(false);
  });
  it("separates equivalence from an awarded score", () => {
    const status = deriveMathStatus({
      isQuestion: false,
      expected: "x + 7 = 12",
      student: "12 = 7 + x",
      awarded: false,
      verdict: { lineId: "l1", correct: true, studentAscii: "12 = 7 + x", at: 1 },
    });
    expect(status).toBe("equivalent");
  });
  it("ignores a verdict that belongs to older working", () => {
    const status = deriveMathStatus({
      isQuestion: false,
      expected: "x + 7 = 12",
      student: "x + 7 = 13",
      awarded: false,
      verdict: { lineId: "l1", correct: true, studentAscii: "x + 7 = 12", at: 1 },
    });
    expect(status).toBe("in_progress");
  });
});

describe("score and note gating", () => {
  it("keeps the note locked and flags the inconsistency when equivalence has no mark", () => {
    const r = report({
      student: "12 = 7 + x",
      verdict: { lineId: "l1", correct: true, studentAscii: "12 = 7 + x", at: 1 },
    });
    expect(r.scoreAwarded).toBe(false);
    expect(r.scoreInconsistent).toBe(true);
    expect(r.noteUnlocked).toBe(false);
  });
  it("unlocks the note only once the line is awarded", () => {
    const r = report({ student: "x + 7 = 12", awarded: true });
    expect(r.status).toBe("completed");
    expect(r.noteUnlocked).toBe(true);
    expect(r.scoreInconsistent).toBe(false);
  });
});

describe("rewards on the active line", () => {
  it("lists only the rewards this line really has", () => {
    const r = report({ row: row({ rewards: [] }) });
    expect(r.rewards).toEqual([]);
  });
  it("reports the Vault as exact-sequence and never as a mark", () => {
    const r = report({
      row: row({
        vaultExpression: "x + 7",
        rewards: [{ id: "vault-1", type: "math-vault", state: "dormant", hidden: false, x: 1, y: 1, expression: "x + 7" } as never],
      }),
      student: "x + 7",
    });
    const vault = r.rewards[0];
    expect(vault.conditionMet).toBe(true);
    expect(vault.condition).toContain("exact order");
    expect(r.scoreAwarded).toBe(false);
  });
  it("does not open a Vault for an equivalent but different order", () => {
    const r = report({
      row: row({
        vaultExpression: "x + 7",
        rewards: [{ id: "vault-1", type: "math-vault", state: "dormant", hidden: false, x: 1, y: 1, expression: "x + 7" } as never],
      }),
      student: "7 + x",
    });
    expect(r.rewards[0].conditionMet).toBe(false);
  });
  it("shows the hourglass payout using the conversion factor", () => {
    const r = report({
      row: row({
        timerSeconds: 10,
        hourglassSeconds: 10,
        rewards: [{ id: "hourglass", type: "time-shard", state: "dormant", hidden: false, x: 1, y: 1 } as never],
      }),
      timedLine: 1,
      hourglassToTime: 2,
    });
    expect(r.rewards[0].stage).toBe("activated");
    expect(r.rewards[0].detail).toContain("20s");
  });
});

describe("activity feed", () => {
  it("never repeats the same entry twice in a row", () => {
    const first = appendEvent([], "Line 1 started", 1);
    const second = appendEvent(first, "Line 1 started", 2);
    expect(second).toHaveLength(1);
    expect(appendEvent(second, "Line 2 started", 3)).toHaveLength(2);
  });
});

describe("predictive line in the report", () => {
  it("reports the shortest remaining route and flags a pending score", () => {
    const report = buildLineReport({
      row: { line: 1, isQuestion: false, lineId: "l1", patternSlot: 0, rewards: [], timerSeconds: 0, hourglassSeconds: 0, vaultExpression: null, vaultCodes: [], vaultCoins: 0 } as never,
      questionRowId: "q1",
      expected: "x + 7 = 12",
      student: "x + 7 = 12",
      note: "note",
      lineMarks: 6,
      awarded: false,
      consumedRewardKeys: [],
      timedLine: null,
      hourglassToTime: 1,
      lifeToTime: 1,
      prediction: { status: "complete", predictive: "x + 7 = 12", remaining: [], complete: true },
    });
    expect(report.predictive).toBe("x + 7 = 12");
    expect(report.remaining).toBeNull();
    expect(report.noRoute).toBe(false);
    expect(report.scoreInconsistent).toBe(true);
    expect(report.noteUnlocked).toBe(false);
  });

  it("says there is no valid route when the engine finds none", () => {
    const report = buildLineReport({
      row: { line: 1, isQuestion: false, lineId: "l1", patternSlot: 0, rewards: [], timerSeconds: 0, hourglassSeconds: 0, vaultExpression: null, vaultCodes: [], vaultCoins: 0 } as never,
      questionRowId: "q1",
      expected: "x + 7 = 12",
      student: "x + 12 = 7",
      note: null,
      lineMarks: 6,
      awarded: false,
      consumedRewardKeys: [],
      timedLine: null,
      hourglassToTime: 1,
      lifeToTime: 1,
      prediction: { status: "no_route", predictive: "", remaining: [], complete: false },
    });
    expect(report.noRoute).toBe(true);
    expect(report.status).toBe("not_equivalent");
  });
});
