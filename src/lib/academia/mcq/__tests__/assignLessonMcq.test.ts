import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ tables: {} as Record<string, any[]>, writes: [] as string[], fail: "" }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "teacher" } } }) },
  rpc: async () => ({ data: "subject", error: null }),
  from: (table: string) => {
    const filters: [string, unknown][] = [];
    let operation = "select", value: any;
    const run = () => {
      if (state.fail === table) return { data: null, error: new Error("write failed") };
      const rows = state.tables[table] ??= [];
      let result = rows.filter(r => filters.every(([k, v]) => r[k] === v));
      if (operation === "insert") {
        result = (Array.isArray(value) ? value : [value]).map((v: any, i: number) => ({ id: `${table}-${rows.length + i}`, ...v }));
        rows.push(...result); state.writes.push(table);
      } else if (operation === "update") {
        result.forEach(r => Object.assign(r, value)); state.writes.push(table);
      }
      return { data: result, error: null };
    };
    const q: any = {
      select: () => q, eq: (k: string, v: unknown) => (filters.push([k, v]), q),
      insert: (v: any) => (operation = "insert", value = v, q),
      update: (v: any) => (operation = "update", value = v, q),
      single: async () => { const r = run(); return { ...r, data: r.data?.[0] ?? null }; },
      then: (resolve: any) => Promise.resolve(run()).then(resolve),
    };
    return q;
  },
} }));
import { assignLessonMcq } from "../assignLessonMcq";
import { inActivityChain } from "../../activityOrder";
const input = { sessionId: "session", notebookId: "note", subsectionId: "sub", title: "Constant term", tier: "intermediate" as const };
beforeEach(() => {
  state.tables = { notebook_blocks: [{ subsection_id: "sub", kind: "problem", content_ascii: "Constant term in 4x + 7?\nA. −7\nB. 7\nCorrect Answer: B" }] };
  state.writes = []; state.fail = "";
});
it("uses the native MCQ paper/items path, and belongs only to Practice", async () => {
  expect(await assignLessonMcq(input)).toBe(true);
  const activity = state.tables.academia_activities[0];
  expect(activity).toMatchObject({ kind: "mcq", tier: "intermediate", subsection_id: "sub" });
  expect(activity.assessment_id).toBeUndefined();
  expect(inActivityChain(activity, "practice")).toBe(true);
  expect(inActivityChain(activity, "play")).toBe(false);
  expect(state.tables.academia_mcq_items[0]).toMatchObject({ n: 1, answer: "B", text: "Constant term in 4x + 7?" });
  expect(state.tables.academia_mcq_papers[0].source_notebook_id).toBe("note");
  expect(state.writes).not.toContain("assessments");
});
it("reassigning refreshes one copy without duplicating its activity or item", async () => {
  await assignLessonMcq(input); await assignLessonMcq(input);
  expect(state.tables.academia_activities).toHaveLength(1);
  expect(state.tables.academia_mcq_items).toHaveLength(1);
  expect(state.tables.academia_mcq_papers).toHaveLength(1);
});
it("converts an earlier floating-style MCQ card in place when reassigned", async () => {
  state.tables.academia_activities = [{ id: "old", session_id: "session", subsection_id: "sub", kind: "question", tier: "intermediate", position: 6, assessment_id: "old-assessment", game_id: "old-game" }];
  await assignLessonMcq(input);
  expect(state.tables.academia_activities).toHaveLength(1);
  expect(state.tables.academia_activities[0]).toMatchObject({ id: "old", kind: "mcq", position: 6, assessment_id: null, game_id: null });
  expect(state.tables.academia_mcq_items[0].activity_id).toBe("old");
});
it("leaves worked questions on their existing assignment path", async () => {
  state.tables.notebook_blocks[0].content_ascii = "Solve 3y − 5 = 10.";
  expect(await assignLessonMcq(input)).toBe(false);
  expect(state.writes).toEqual([]);
});
it("refuses to move the same question across tier batches", async () => {
  await assignLessonMcq(input);
  await expect(assignLessonMcq({ ...input, tier: "expert" })).rejects.toThrow("Intermediate batch");
  expect(state.tables.academia_activities).toHaveLength(1);
});
it("does not fall back to a floating activity when the MCQ source cannot be read", async () => {
  state.fail = "notebook_blocks";
  await expect(assignLessonMcq(input)).rejects.toThrow("write failed");
  expect(state.writes).toEqual([]);
});
it("recovers a failed item save without creating a second card or paper", async () => {
  state.fail = "academia_mcq_items";
  await expect(assignLessonMcq(input)).rejects.toThrow("write failed");
  state.fail = "";
  await assignLessonMcq(input);
  expect(state.tables.academia_activities).toHaveLength(1);
  expect(state.tables.academia_mcq_papers).toHaveLength(1);
  expect(state.tables.academia_mcq_items).toHaveLength(1);
});
