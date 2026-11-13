import { describe, expect, it } from "vitest";
import { ensureAttempt, recordMarks, removeAttempt, totals, currentAttempt, classifyAttemptTier, attemptsForView, viewScore, type SessionAttempt, type SessionContext } from "../evaluation";

const ctx = (sessionId: string, activityMax: Record<string, number> = { a: 10 }): SessionContext => ({
  sessionId, sessionTitle: sessionId, trail: "", schoolId: "s", classId: "c", subjectId: "m", subjectName: "Maths",
  topicId: "t", topicName: "T", subtopicId: "u", subtopicName: "U", activityMax,
});
const now = (n: number) => new Date(2026, 0, 1, 0, n).toISOString();

function finished(sessionId: string, marks: number, n: number): SessionAttempt[] {
  let { attempts, attempt } = ensureAttempt([], ctx(sessionId), { now: now(n), id: `${sessionId}-${n}` });
  attempt = recordMarks(attempt, { eventId: "e", activityId: "a", mode: "practice", marks, now: now(n) });
  return attempts.map((x) => (x.id === attempt.id ? attempt : x));
}

describe("Academia cumulative evaluation", () => {
  it("90/100 then a restarted 8/10 attempt gives 98/110 = 89.09%", () => {
    let all: SessionAttempt[] = [];
    for (let i = 0; i < 10; i++) all = [...all, ...finished(`s${i}`, 9, i)];
    expect(totals(all)).toMatchObject({ earned: 90, possible: 100, percent: 90 });
    let r = ensureAttempt(all, ctx("s0"), { now: now(50), id: "new", restart: true });
    const a = recordMarks(r.attempt, { eventId: "x", activityId: "a", mode: "play", marks: 8, now: now(51) });
    all = r.attempts.map((x) => (x.id === a.id ? a : x));
    expect(totals(all)).toMatchObject({ earned: 98, possible: 110, percent: 89.09 });
  });
  it("Continue reuses the attempt and adds no possible marks", () => {
    const first = ensureAttempt([], ctx("s"), { now: now(1), id: "1" });
    const again = ensureAttempt(first.attempts, ctx("s"), { now: now(2), id: "2" });
    expect(again.created).toBe(false);
    expect(totals(again.attempts).possible).toBe(10);
  });
  it("no attempt exists until the first input", () => {
    expect(totals([]).percent).toBeNull();
  });
  it("removed unfinished attempts leave the totals; completed ones cannot be removed", () => {
    const done = finished("a", 10, 1)[0];
    const open = ensureAttempt([], ctx("b"), { now: now(2), id: "b" }).attempt;
    expect(totals([done, removeAttempt(open, now(3))])).toMatchObject({ earned: 10, possible: 10 });
    expect(removeAttempt(done, now(4)).status).toBe("completed");
  });
  it("the same marking event is counted once and marks are capped", () => {
    let a = ensureAttempt([], ctx("s", { a: 4, b: 6 }), { now: now(1), id: "1" }).attempt;
    a = recordMarks(a, { eventId: "l1", activityId: "a", mode: "practice", marks: 2, now: now(2) });
    a = recordMarks(a, { eventId: "l1", activityId: "a", mode: "practice", marks: 2, now: now(2) });
    expect(totals([a]).earned).toBe(2);
    a = recordMarks(a, { eventId: "l2", activityId: "a", mode: "practice", marks: 99, now: now(3) });
    expect(totals([a]).earned).toBe(4);
    expect(a.status).toBe("in_progress");
  });
  it("activities share the Session's 10 marks and completion needs all of them", () => {
    let a = ensureAttempt([], ctx("s", { a: 4, b: 6 }), { now: now(1), id: "1" }).attempt;
    a = recordMarks(a, { eventId: "1", activityId: "a", mode: "practice", marks: 4, now: now(2) });
    expect(a.status).toBe("in_progress");
    a = recordMarks(a, { eventId: "2", activityId: "b", mode: "play", marks: 6, now: now(3) });
    expect(a.status).toBe("completed");
    expect(totals([a])).toMatchObject({ earned: 10, possible: 10 });
  });
  it("Restart keeps the old attempt but Continue moves to the new one", () => {
    const first = ensureAttempt([], ctx("s"), { now: now(1), id: "1" });
    const second = ensureAttempt(first.attempts, ctx("s"), { now: now(2), id: "2", restart: true });
    expect(second.attempts).toHaveLength(2);
    expect(currentAttempt(second.attempts, "s")?.id).toBe("2");
  });

  it("keeps Beginner, Intermediate and Expert attempts apart", () => {
    const tiers = { b: "beginner", i: "intermediate", e: "expert" };
    const begin = ensureAttempt([], { ...ctx("s", { b: 10 }), tier: "beginner" }, { now: now(1), id: "b", activityTiers: tiers });
    const mid = ensureAttempt(begin.attempts, { ...ctx("s", { i: 10 }), tier: "intermediate" }, { now: now(2), id: "i", activityTiers: tiers });
    expect(mid.created).toBe(true);
    expect(currentAttempt(mid.attempts, "s", "beginner", tiers)?.id).toBe("b");
    let b = recordMarks(mid.attempts.find((a) => a.id === "b")!, { eventId: "1", activityId: "b", mode: "practice", marks: 3, now: now(3) });
    let i = recordMarks(mid.attempts.find((a) => a.id === "i")!, { eventId: "2", activityId: "i", mode: "practice", marks: 4, now: now(4) });
    const all = mid.attempts.map((a) => (a.id === "b" ? b : a.id === "i" ? i : a));
    expect(viewScore(all, "beginner", tiers)).toMatchObject({ percent: 30 });
    expect(viewScore(all, "intermediate", tiers)).toMatchObject({ percent: 40 });
    expect(viewScore(all, "expert", tiers).percent).toBeNull();
    b = recordMarks(b, { eventId: "3", activityId: "b", mode: "practice", marks: 7, now: now(5) });
    const after = all.map((a) => (a.id === "b" ? b : a));
    expect(viewScore(after, "beginner", tiers).percent).toBe(100);
    expect(viewScore(after, "intermediate", tiers)).toEqual(viewScore(all, "intermediate", tiers));
  });

  it("infers one tier from the activities and leaves a mix untiered, counted only in Overall", () => {
    const plain = ensureAttempt([], ctx("s", { b1: 10, b2: 10 }), { now: now(1), id: "old" }).attempt;
    const mixed = ensureAttempt([], ctx("s2", { b: 10, e: 10 }), { now: now(2), id: "mix" }).attempt;
    const map = { b1: "beginner", b2: "beginner", b: "beginner", e: "expert" };
    expect(classifyAttemptTier(plain, map)).toBe("beginner");
    expect(classifyAttemptTier(mixed, map)).toBeNull();
    const scored = [
      recordMarks(plain, { eventId: "1", activityId: "b1", mode: "practice", marks: 10, now: now(3) }),
      recordMarks(mixed, { eventId: "2", activityId: "b", mode: "practice", marks: 10, now: now(4) }),
    ];
    expect(attemptsForView(scored, "beginner", map).map((a) => a.id)).toEqual(["old"]);
    expect(attemptsForView(scored, "expert", map)).toHaveLength(0);
    expect(attemptsForView(scored, "overall", map)).toHaveLength(2);
    expect(viewScore(scored, "overall", map).possible).toBe(20);
    expect(viewScore(scored, "beginner", map).possible).toBe(10);
  });
});
