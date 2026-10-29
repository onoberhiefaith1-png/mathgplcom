import { describe, expect, it } from "vitest";
import {
  CrossTierMoveError,
  NOT_STARTED_LABEL,
  assertSingleTier,
  buildClassSubjectReport,
  cancelDecision,
  groupByTier,
  moveWithinTier,
  normalizeTier,
  rollUpTier,
  sessionTierEvaluations,
  sortByTier,
} from "../tiers";

const acts = [
  { id: "e1", tier: "expert", position: 0 },
  { id: "b2", tier: "beginner", position: 1 },
  { id: "i1", tier: "intermediate", position: 0 },
  { id: "old", tier: null, position: 0 },
  { id: "b3", tier: "beginner", position: 2 },
];

describe("tiers", () => {
  it("defaults old or unknown rows to beginner", () => {
    expect(normalizeTier(undefined)).toBe("beginner");
    expect(normalizeTier("weird")).toBe("beginner");
    expect(normalizeTier("expert")).toBe("expert");
  });

  it("orders Beginner → Intermediate → Expert, position inside each", () => {
    expect(sortByTier(acts).map((a) => a.id)).toEqual(["old", "b2", "b3", "i1", "e1"]);
    const g = groupByTier(acts);
    expect(g.beginner.map((a) => a.id)).toEqual(["old", "b2", "b3"]);
    expect(g.intermediate.map((a) => a.id)).toEqual(["i1"]);
    expect(g.expert.map((a) => a.id)).toEqual(["e1"]);
  });

  it("swaps only inside one tier and refuses to leave it", () => {
    expect(moveWithinTier(acts, "b2", 1)).toEqual({ tier: "beginner", ids: ["old", "b3", "b2"] });
    expect(moveWithinTier(acts, "b3", 1)).toBeNull(); // last beginner cannot slide into intermediate
    expect(moveWithinTier(acts, "i1", -1)).toBeNull(); // first intermediate cannot slide into beginner
  });

  it("guards reorder lists that mix tiers", () => {
    expect(assertSingleTier(acts, ["b2", "b3"])).toBe("beginner");
    expect(() => assertSingleTier(acts, ["b3", "i1"])).toThrow(CrossTierMoveError);
    expect(() => assertSingleTier(acts, ["nope"])).toThrow();
  });
});

describe("per-tier evaluation", () => {
  const attempts = [
    { session_id: "s1", mode: "practice", tier: "beginner", best_score: 7, max_score: 10, status: "in_progress" },
    { session_id: "s1", mode: "practice", tier: "intermediate", best_score: 10, max_score: 10, status: "completed" },
    { session_id: "s2", mode: "practice", tier: "expert", best_score: 3, max_score: 5, status: "in_progress" },
  ];
  it("keeps three separate evaluations; untouched tiers are not started yet", () => {
    const ev = sessionTierEvaluations(attempts, "s1");
    expect(ev.map((e) => e.status)).toEqual(["in_progress", "completed", "not_started"]);
    expect(ev[0]).toMatchObject({ score: 7, max: 10 });
    expect(ev[2]).toMatchObject({ score: 0, max: 0, label: NOT_STARTED_LABEL });
  });

  it("rolls activity marks into a tier", () => {
    const r = rollUpTier({ a: { score: 2, max: 3, done: true }, b: { score: 1, max: 2, done: false }, other: { score: 9, max: 9, done: true } }, ["a", "b"]);
    expect(r).toEqual({ score: 3, max: 5, completed: false, counted: 2 });
    expect(rollUpTier({ a: { score: 3, max: 3, done: true } }, ["a"]).completed).toBe(true);
  });
});

describe("class–subject report", () => {
  const sessions = [{ id: "s1", title: "Counting" }, { id: "s2", title: "Adding" }];
  const activities = [
    { id: "a", session_id: "s1", tier: "beginner", max: 10 },
    { id: "b", session_id: "s1", tier: "intermediate", max: 10 },
    { id: "c", session_id: "s2", tier: "beginner", max: 20 },
    { id: "d", session_id: "s2", tier: "expert", max: 30 },
    // Another class/subject pair — must never be combined.
    { id: "x", session_id: "other", tier: "beginner", max: 999 },
  ];
  const attempts = [
    { session_id: "s1", mode: "practice", tier: "beginner", best_score: 6, max_score: 10, status: "in_progress" },
    { session_id: "s1", mode: "play", tier: "beginner", best_score: 0, max_score: 0, status: "in_progress" },
    { session_id: "other", mode: "practice", tier: "beginner", best_score: 999, max_score: 999, status: "completed" },
  ];

  it("scores attempted-over-attempted with the pair's full total as context", () => {
    const r = buildClassSubjectReport({ sessions, activities, attempts });
    expect(r.attemptedScore).toBe(6);
    expect(r.attemptedMax).toBe(10);
    expect(r.totalMax).toBe(70);
    expect(r.ladder.map((s) => [s.tier, s.sessionsAttempted, s.totalMax])).toEqual([
      ["beginner", 1, 30], ["intermediate", 0, 10], ["expert", 0, 30],
    ]);
    expect(r.sessions[1].tiers.every((t) => t.status === "not_started")).toBe(true);
  });

  it("drops a cancelled (wiped) attempt from totals", () => {
    const r = buildClassSubjectReport({ sessions, activities, attempts: [] });
    expect([r.attemptedScore, r.attemptedMax, r.totalMax]).toEqual([0, 0, 70]);
  });
});

describe("cancel rules", () => {
  const base = { callerIsLearner: true, callerIsTeacher: false, teacherAssigned: false, alreadyCancelled: false, hasAttempt: true };
  it("lets a learner cancel self-practice once", () => {
    expect(cancelDecision(base)).toEqual({ ok: true });
    expect(cancelDecision({ ...base, alreadyCancelled: true })).toEqual({ ok: false, reason: "already_cancelled" });
  });
  it("blocks students on teacher-assigned Sessions, but not teachers", () => {
    expect(cancelDecision({ ...base, teacherAssigned: true })).toEqual({ ok: false, reason: "teacher_assigned" });
    expect(cancelDecision({ ...base, callerIsLearner: false, callerIsTeacher: true, teacherAssigned: true })).toEqual({ ok: true });
  });
  it("still allows only one cancel even for teachers, and needs an attempt", () => {
    expect(cancelDecision({ ...base, callerIsTeacher: true, alreadyCancelled: true }).ok).toBe(false);
    expect(cancelDecision({ ...base, hasAttempt: false })).toEqual({ ok: false, reason: "nothing_to_cancel" });
    expect(cancelDecision({ ...base, callerIsLearner: false })).toEqual({ ok: false, reason: "not_allowed" });
  });
});
