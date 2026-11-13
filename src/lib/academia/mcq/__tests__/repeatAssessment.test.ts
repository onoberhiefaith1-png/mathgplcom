import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ rows: [] as any[], updates: [] as string[] }));
vi.mock("@/lib/assignments/instances", () => ({ ensureAssignment: async () => ({ assignment: { id: "instance" } }), archiveAssignment: vi.fn(), autoArchiveExpired: vi.fn() }));
vi.mock("@/lib/assessments/createAssessment", () => ({ compileSectionQuestions: async () => ({ questions: [{ id: "question", lines: [{ marks: 1 }] }], answerKey: [{ tokens: ["5"] }], total: 1 }), compileQuestionSections: vi.fn() }));
vi.mock("@/lib/db/scope", () => ({ db: () => ({ auth: { getUser: async () => ({ data: { user: { id: "teacher" } } }) }, from: (table: string) => {
  let op = "select", value: any, id: string | undefined;
  const run = () => {
    if (table === "learning_assignments") return { data: [], error: null };
    if (table === "assessment_answer_keys") return { data: [], error: null };
    if (table !== "assessments") throw new Error(`Unexpected progress mutation: ${table}`);
    if (op === "insert") { const row = { id: `assessment-${state.rows.length}`, ...value }; state.rows.push(row); return { data: row, error: null }; }
    if (op === "update") { state.updates.push(id!); Object.assign(state.rows.find(r => r.id === id), value); }
    return { data: state.rows, error: null };
  };
  const q: any = { select: () => q, eq: (k: string, v: string) => (k === "id" && (id = v), q), neq: () => q, order: () => q,
    insert: (v: any) => (op = "insert", value = v, q), update: (v: any) => (op = "update", value = v, q), delete: () => q,
    single: async () => run(), then: (resolve: any) => Promise.resolve(run()).then(resolve) };
  return q;
} }) }));
import { assignAssessmentQuestion } from "@/lib/assignments/pipeline";
const input = { classId: "class", notebookId: "note", ref: { subsectionId: "sub", sectionId: "section", questionKey: "source-key" }, kind: "practice" as const, title: "Solve", scoreLabel: "Marks" };
beforeEach(() => { state.rows = []; state.updates = []; });
it("Academia copies get independent assessment IDs and never overwrite earlier progress", async () => {
  const a = await assignAssessmentQuestion({ ...input, independentCopy: true });
  const first = structuredClone(state.rows[0]);
  const b = await assignAssessmentQuestion({ ...input, independentCopy: true });
  expect(a).not.toBe(b); expect(state.rows).toHaveLength(2);
  expect(state.rows[0]).toEqual(first); expect(state.updates).toEqual([]);
  expect(state.rows[0].question_key).not.toBe(state.rows[1].question_key);
  expect(state.rows.every(r => r.section_id === "section" && r.total_marks === 1)).toBe(true);
});
it("ordinary class Assign keeps its existing idempotent behavior", async () => {
  const a = await assignAssessmentQuestion(input); const b = await assignAssessmentQuestion(input);
  expect(a).toBe(b); expect(state.rows).toHaveLength(1);
});
