import { describe, it, expect } from "vitest";
import {
  POLL_FALLBACK_MS,
  POLL_HIDDEN_MS,
  POLL_LIVE_MS,
  acceptBoard,
  changedChampions,
  pollDelayMs,
  sliceHue,
} from "@/lib/arena/liveBoard";
import { bestPerParticipant, type ArenaBest } from "@/lib/arena/ranking";

const board = (at: string | undefined, ms: number | null, name = "Ada") => ({
  generatedAt: at,
  columns: [{ assessmentId: "q1", top: ms == null ? [] : [{ name, ms }] }],
});

describe("Live Report merging", () => {
  it("the first snapshot is accepted", () => {
    const b = board("2026-10-26T10:00:00Z", 5000);
    expect(acceptBoard(null, b)).toBe(b);
  });
  it("a newer snapshot replaces the older", () => {
    const a = board("2026-10-26T10:00:00Z", 5000);
    const b = board("2026-10-26T10:00:03Z", 4000);
    expect(acceptBoard(a, b)).toBe(b);
  });
  it("an out-of-order older reply never overwrites a newer one", () => {
    const a = board("2026-10-26T10:00:05Z", 4000);
    const late = board("2026-10-26T10:00:01Z", 9000);
    expect(acceptBoard(a, late)).toBe(a);
  });
  it("an unstamped reply is accepted (older servers)", () => {
    const a = board("2026-10-26T10:00:05Z", 4000);
    const b = board(undefined, 3000);
    expect(acceptBoard(a, b)).toBe(b);
  });
  it("flags only the questions whose champion changed", () => {
    const before = {
      columns: [
        { assessmentId: "q1", top: [{ name: "Ada", ms: 5000 }] },
        { assessmentId: "q2", top: [{ name: "Ben", ms: 7000 }] },
      ],
    };
    const after = {
      columns: [
        { assessmentId: "q1", top: [{ name: "Ada", ms: 4800 }] },
        { assessmentId: "q2", top: [{ name: "Ben", ms: 7000 }] },
      ],
    };
    expect([...changedChampions(before, after)]).toEqual(["q1"]);
    expect(changedChampions(null, after).size).toBe(0);
  });
  it("a first champion on an empty question is a change", () => {
    const before = { columns: [{ assessmentId: "q1", top: [] }] };
    const after = {
      columns: [{ assessmentId: "q1", top: [{ name: "Ada", ms: 5000 }] }],
    };
    expect(changedChampions(before, after).has("q1")).toBe(true);
  });
});

describe("Live Report polling cadence", () => {
  it("polls quickly when realtime is not connected and gently when it is", () => {
    expect(pollDelayMs({ realtime: false, hidden: false, failures: 0 })).toBe(
      POLL_FALLBACK_MS,
    );
    expect(pollDelayMs({ realtime: true, hidden: false, failures: 0 })).toBe(
      POLL_LIVE_MS,
    );
    expect(POLL_FALLBACK_MS).toBeLessThanOrEqual(5000);
  });
  it("slows down in a background tab and backs off while failing, but never past 30s", () => {
    expect(pollDelayMs({ realtime: true, hidden: true, failures: 0 })).toBe(
      POLL_HIDDEN_MS,
    );
    expect(pollDelayMs({ realtime: false, hidden: false, failures: 2 })).toBe(
      POLL_FALLBACK_MS * 3,
    );
    expect(pollDelayMs({ realtime: true, hidden: true, failures: 50 })).toBe(
      30_000,
    );
  });
  it("slice hues wrap around safely", () => {
    expect(sliceHue(0)).toBe(sliceHue(8));
    expect(sliceHue(-1)).toBeTruthy();
  });
});

describe("one row per student", () => {
  const b = (id: string, ms: number, at: string, att: string): ArenaBest => ({
    participantId: id,
    bestMs: ms,
    achievedAt: at,
    attemptId: att,
  });
  it("keeps only a student's fastest best when a card has several question ids", () => {
    const rows = [
      b("ada", 9000, "2026-10-26T10:00:00Z", "a1"),
      b("ada", 7000, "2026-10-26T10:05:00Z", "a2"),
      b("ben", 8000, "2026-10-26T10:01:00Z", "b1"),
    ];
    const one = bestPerParticipant(rows);
    expect(one).toHaveLength(2);
    expect(one.find((r) => r.participantId === "ada")!.bestMs).toBe(7000);
  });
});
