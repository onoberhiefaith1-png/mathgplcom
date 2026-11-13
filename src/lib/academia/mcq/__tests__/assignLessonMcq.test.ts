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
        // Match the live subject + whole-source-note unique constraint.
        if (table === "academia_mcq_papers" && value.source_notebook_id != null && rows.some(r => r.subject_id === value.subject_id && r.source_notebook_id === value.source_notebook_id)) {
          return { data: null, error: new Error("duplicate key value violates unique constraint academia_mcq_papers_subject_id_source_notebook_id_key") };
        }
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
  expect(state.tables.academia_mcq_papers[0].source_notebook_id).toBeNull();
  expect(state.tables.academia_mcq_papers[0].questions[0].source).toEqual({ notebookId: "note", subsectionId: "sub" });
  expect(state.writes).not.toContain("assessments");
});
it("rejects the exact same question in the same destination without changing the saved copy", async () => {
  await assignLessonMcq(input);
  const before = JSON.stringify(state.tables);
  await expect(assignLessonMcq(input)).rejects.toThrow("This question is already assigned to this Session");
  expect(JSON.stringify(state.tables)).toBe(before);
  expect(state.tables.academia_activities).toHaveLength(1);
  expect(state.tables.academia_mcq_items).toHaveLength(1);
  expect(state.tables.academia_mcq_papers).toHaveLength(1);
});
it("assigns different questions from one note to the same Session under the live unique rule", async () => {
  state.tables.notebook_blocks.push({ subsection_id: "second", kind: "problem", content_ascii: "Read x < 4.\nA. Less than 4\nB. Greater than 4\nCorrect Answer: A" });
  // An existing full paper imported from the same note must also be untouched.
  const fullPaper = { id: "full-paper", subject_id: "subject", source_notebook_id: "note", questions: [{ n: 50, answer: "D" }] };
  state.tables.academia_mcq_papers = [structuredClone(fullPaper)];
  await assignLessonMcq(input);
  await assignLessonMcq({ ...input, subsectionId: "second", title: "Read inequality" });
  expect(state.tables.academia_activities).toHaveLength(2);
  expect(state.tables.academia_mcq_items.map(r => r.answer)).toEqual(["B", "A"]);
  expect(new Set(state.tables.academia_activities.map(a => a.ref_id)).size).toBe(2);
  expect(state.tables.academia_mcq_papers[0]).toEqual(fullPaper);
});
it("allows the same question in a different Session", async () => {
  await assignLessonMcq(input);
  await assignLessonMcq({ ...input, sessionId: "other-session" });
  expect(state.tables.academia_activities).toHaveLength(2);
});
it("allows assigning again after the first activity has been removed", async () => {
  await assignLessonMcq(input);
  state.tables.academia_activities = [];
  state.tables.academia_mcq_items = []; // ON DELETE CASCADE in the native engine.
  await assignLessonMcq(input);
  expect(state.tables.academia_activities).toHaveLength(1);
  expect(state.tables.academia_mcq_items).toHaveLength(1);
});
it("converts an earlier floating-style MCQ card in place when reassigned", async () => {
  state.tables.academia_activities = [{ id: "old", session_id: "session", subsection_id: "sub", kind: "question", tier: "intermediate", position: 6, assessment_id: "old-assessment", game_id: "old-game" }];
  await assignLessonMcq(input);
  expect(state.tables.academia_activities).toHaveLength(1);
  expect(state.tables.academia_activities[0]).toMatchObject({ id: "old", kind: "mcq", position: 6, assessment_id: null, game_id: null });
  expect(state.tables.academia_mcq_items[0].activity_id).toBe("old");
});
it("resumes an interrupted old-card conversion without duplicating its saved item", async () => {
  state.tables.academia_activities = [{ id: "old", session_id: "session", subsection_id: "sub", kind: "question", tier: "intermediate" }];
  state.tables.academia_mcq_items = [{ id: "saved-item", activity_id: "old", n: 1, answer: "A" }];
  await assignLessonMcq(input);
  expect(state.tables.academia_mcq_items).toHaveLength(1);
  expect(state.tables.academia_mcq_items[0]).toMatchObject({ id: "saved-item", answer: "B" });
  expect(state.tables.academia_activities[0].kind).toBe("mcq");
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
