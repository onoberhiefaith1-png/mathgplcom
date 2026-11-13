import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ doc: null as unknown, writes: [] as { table: string; value: any }[] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "teacher" } } }) },
  from: (table: string) => {
    if (table === "notebooks") {
      const query = { select: () => query, eq: () => query, single: async () => ({ data: { id: "note", title: "Inequalities", document_json: state.doc }, error: null }) };
      return query;
    }
    if (table === "academia_activities") return {
      select: () => ({ eq: async () => ({ data: [], error: null }) }),
      insert: (value: unknown) => {
        state.writes.push({ table, value });
        return { select: () => ({ single: async () => ({ data: { id: "activity" }, error: null }) }) };
      },
    };
    if (table === "academia_mcq_items") return { insert: async (value: unknown) => { state.writes.push({ table, value }); return { error: null }; } };
    throw new Error(`Unexpected table ${table}`);
  },
} }));
import { assignPaperToSession, previewNote } from "../api";
it("previews only supplied MCQs and copies a chosen question through the existing Session path", async () => {
  const source = readFileSync(new URL("./fixtures/mixed-inequalities.md", import.meta.url), "utf8");
  state.doc = { type: "doc", content: source.split("\n").map(text => ({ type: "paragraph", content: [{ type: "text", text }] })) };
  const before = JSON.stringify(state.doc);
  const preview = await previewNote("note");
  expect(preview.questions).toHaveLength(3);
  expect(preview.skippedWorked).toBe(2);
  expect(state.writes).toEqual([]);
  const paper = { id: "paper", title: preview.title, subject_id: "subject", source_notebook_id: "note", questions: preview.questions };
  await assignPaperToSession("session", paper, [2]);
  const rows = state.writes.find(w => w.table === "academia_mcq_items")!.value;
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ activity_id: "activity", n: 2, text: "Does x = 3 satisfy x ≥ 3?", answer: "A" });
  expect(rows[0].options).toHaveLength(4);
  expect(state.writes.find(w => w.table === "academia_activities")!.value.kind).toBe("mcq");
  expect(JSON.stringify(state.doc)).toBe(before);
});
