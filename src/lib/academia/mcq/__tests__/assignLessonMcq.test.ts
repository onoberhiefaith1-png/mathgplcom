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
      } else if (operation === "delete") {
        state.tables[table] = rows.filter(r => !result.includes(r)); state.writes.push(table);
      } else if (operation === "update") {
        result.forEach(r => Object.assign(r, value)); state.writes.push(table);
      }
      return { data: result, error: null };
    };
    const q: any = {
      select: () => q, delete: () => (operation = "delete", q), eq: (k: string, v: unknown) => (filters.push([k, v]), q),
      insert: (v: any) => (operation = "insert", value = v, q),
      update: (v: any) => (operation = "update", value = v, q),
      single: async () => { const r = run(); return { ...r, data: r.data?.[0] ?? null }; },
      then: (resolve: any) => Promise.resolve(run()).then(resolve),
    };
    return q;
  },
} }));
import { assignLessonMcq } from "../assignLessonMcq";
import { assignPaperToSession } from "../api";
import { inActivityChain } from "../../activityOrder";
const input = { sessionId: "session", notebookId: "note", subsectionId: "sub", title: "Constant term", tier: "intermediate" as const };
beforeEach(() => {
  state.tables = { notebook_blocks: [{ subsection_id: "sub", kind: "problem", content_ascii: "Constant term in 4x + 7?\nA. −7\nB. 7\nCorrect Answer: B" }] };
  state.writes = []; state.fail = "";
});
it("creates one native MCQ copy with its source identity preserved", async () => {
  await assignLessonMcq(input);
  expect(state.tables.academia_activities[0]).toMatchObject({ kind: "mcq", tier: "intermediate", subsection_id: "sub" });
  expect(state.tables.academia_mcq_items[0]).toMatchObject({ n: 1, answer: "B" });
  expect(state.tables.academia_mcq_papers[0].source_notebook_id).toBeNull();
  expect(state.tables.academia_mcq_papers[0].questions[0].source).toEqual({ notebookId: "note", subsectionId: "sub" });
  expect(inActivityChain(state.tables.academia_activities[0], "play")).toBe(false);
});
it("allows the exact same question 100 times as separately removable activities", async () => {
  for (let i = 0; i < 100; i++) await assignLessonMcq(input);
  expect(state.tables.academia_activities).toHaveLength(100);
  expect(state.tables.academia_mcq_items).toHaveLength(100);
  expect(state.tables.academia_mcq_papers).toHaveLength(100);
  expect(new Set(state.tables.academia_activities.map(a => a.id)).size).toBe(100);
  expect(new Set(state.tables.academia_activities.map(a => a.ref_id)).size).toBe(100);
  const survivor = structuredClone(state.tables.academia_mcq_items[1]);
  const first = state.tables.academia_activities.shift();
  state.tables.academia_mcq_items = state.tables.academia_mcq_items.filter(r => r.activity_id !== first.id);
  expect(state.tables.academia_activities).toHaveLength(99);
  expect(state.tables.academia_mcq_items).toContainEqual(survivor);
});
it("allows the same question in another tier without moving the earlier copy", async () => {
  await assignLessonMcq(input);
  await assignLessonMcq({ ...input, tier: "expert" });
  expect(state.tables.academia_activities.map(a => a.tier)).toEqual(["intermediate", "expert"]);
});
it("keeps earlier floating-style cards unchanged and adds a new MCQ copy", async () => {
  const old = { id: "old", session_id: "session", subsection_id: "sub", kind: "question", tier: "intermediate", position: 6 };
  state.tables.academia_activities = [structuredClone(old)];
  await assignLessonMcq(input);
  expect(state.tables.academia_activities).toHaveLength(2);
  expect(state.tables.academia_activities[0]).toEqual(old);
});
it("allows different questions alongside an existing whole-note paper", async () => {
  state.tables.academia_mcq_papers = [{ id: "full", subject_id: "subject", source_notebook_id: "note" }];
  state.tables.notebook_blocks.push({ subsection_id: "other", kind: "problem", content_ascii: "2 + 2?\nA. 4\nB. 5\nCorrect Answer: A" });
  await assignLessonMcq(input); await assignLessonMcq({ ...input, subsectionId: "other" });
  expect(state.tables.academia_activities).toHaveLength(2);
  expect(state.tables.academia_mcq_items.map(r => r.answer)).toEqual(["B", "A"]);
});
it("leaves worked questions on their normal assignment path", async () => {
  state.tables.notebook_blocks[0].content_ascii = "Solve 3y − 5 = 10.";
  expect(await assignLessonMcq(input)).toBe(false); expect(state.writes).toEqual([]);
});
it("cleans an unsuccessful copy so retry creates only one usable activity", async () => {
  state.fail = "academia_mcq_items";
  await expect(assignLessonMcq(input)).rejects.toThrow("write failed");
  expect(state.tables.academia_activities).toHaveLength(0);
  expect(state.tables.academia_mcq_papers).toHaveLength(0);
  state.fail = ""; await assignLessonMcq(input);
  expect(state.tables.academia_activities).toHaveLength(1);
});
it("allows repeatedly selecting the same question from an existing MCQ paper", async () => {
  const paper = { id: "paper", subject_id: "subject", source_notebook_id: "note", title: "Paper", questions: [{ n: 7, text: "2+2?", options: [{ label: "A", text: "4" }, { label: "B", text: "5" }], answer: "A" }] };
  await assignPaperToSession("session", paper, [7]);
  await assignPaperToSession("session", paper, [7]);
  expect(state.tables.academia_activities).toHaveLength(2);
  expect(state.tables.academia_mcq_items).toHaveLength(2);
  expect(state.tables.academia_mcq_items[0].activity_id).not.toBe(state.tables.academia_mcq_items[1].activity_id);
});
