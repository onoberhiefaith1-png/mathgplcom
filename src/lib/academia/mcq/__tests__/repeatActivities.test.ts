import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ activities: [] as any[], assign: vi.fn(async (_input: any) => `assessment-${state.activities.length}`) }));
vi.mock("@/lib/academia/mcq/assignLessonMcq", () => ({ assignLessonMcq: async () => false }));
vi.mock("@/lib/assignments/pipeline", () => ({ resolveQuestionRef: async () => ({ sectionId: "section", questionKey: "source", subsectionId: "sub" }), assignAssessmentQuestion: state.assign }));
vi.mock("@/lib/slate/gameAssignments", () => ({}));
vi.mock("@/lib/adventures/classAdventureLinks", () => ({ linkAdventure: async () => {} }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "teacher" } } }) },
  from: (table: string) => {
    let value: any;
    const run = () => {
      if (table === "classes") return { data: [{ id: "class" }], error: null };
      if (table !== "academia_activities") throw new Error(`Unexpected table ${table}`);
      if (value) state.activities.push({ id: `activity-${state.activities.length}`, ...value });
      return { data: state.activities, error: null };
    };
    const q: any = { select: () => q, eq: () => q, order: () => q, limit: () => q,
      insert: (v: any) => (value = v, q), then: (resolve: any) => Promise.resolve(run()).then(resolve) };
    return q;
  },
} }));
import { addSessionAdventure, assignToAcademia } from "../../api";
beforeEach(() => { state.activities = []; state.assign.mockClear(); });
it("each worked-question Assign appends a separate card and requests independent Practice", async () => {
  const input = { sessionId: "session", notebookId: "note", subsectionId: "sub", title: "Solve", gameId: null, tier: "beginner" as const };
  for (let i = 0; i < 100; i++) await assignToAcademia(input);
  expect(state.activities).toHaveLength(100);
  expect(new Set(state.activities.map(a => a.assessment_id)).size).toBe(100);
  expect(state.assign.mock.calls.every(([arg]) => arg.independentCopy === true)).toBe(true);
  await assignToAcademia({ ...input, tier: "expert" });
  expect(state.activities[100].tier).toBe("expert");
  expect(state.activities[0].tier).toBe("beginner");
});
it("allows adding the same Adventure repeatedly without replacing an earlier activity", async () => {
  const input = { sessionId: "session", gameId: "adventure", title: "Adventure" };
  await addSessionAdventure(input); await addSessionAdventure(input);
  expect(state.activities).toHaveLength(2);
  expect(state.activities.map(a => a.kind)).toEqual(["adventure", "adventure"]);
  expect(state.activities[0].id).not.toBe(state.activities[1].id);
});
