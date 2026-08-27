// Opening an Exercise Card question must reuse ONE hidden test container per
// (block, question) and carry that question's own answer key, so the existing
// Test Smartboard stays in test mode instead of trying to open a notebook.
import { describe, expect, it, vi } from "vitest";

const Q1 = "11111111-1111-4111-8111-111111111111";
const Q2 = "22222222-2222-4222-8222-222222222222";

const links = [
  { id: "l1", block_id: "b1", position: 0, total_marks: 4, section_id: "s1", subsection_id: Q1, label: "Q1" },
  { id: "l2", block_id: "b1", position: 1, total_marks: 6, section_id: "s1", subsection_id: Q2, label: "Q2" },
];

const inserts: any[] = [];
const upserts: any[] = [];
let existing: { id: string }[] = [];

const query = (rows: unknown, table?: string) => {
  const q: any = {
    select: () => q,
    eq: () => q,
    in: () => q,
    order: () => q,
    delete: () => q,
    update: () => q,
    insert: (row: any) => { inserts.push({ table, row }); return q; },
    upsert: (row: any) => { upserts.push({ table, row }); return q; },
    single: async () => ({ data: { id: "a-new" }, error: null }),
    maybeSingle: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows, error: null }),
    then: (res: (v: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(res),
  };
  return q;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "teacher-1" } } }) },
    from: (table: string) => {
      if (table === "course_exercise_questions") return query(links, table);
      if (table === "course_blocks") return query([{ config: { name: "Algebra drill" } }], table);
      if (table === "assessments") return query(existing, table);
      return query([], table);
    },
  },
}));

vi.mock("@/lib/floating/testBoard", () => ({
  ensureTestClass: async () => "hidden-class",
}));

vi.mock("@/lib/assessments/createAssessment", () => ({
  compileSectionQuestions: async (sectionId: string) => {
    if (sectionId !== "s1") return { questions: [], answerKey: [], total: 0 };
    return {
      questions: [
        { id: Q1, questionText: "Q1", lines: [{ lineId: "a", marks: 2 }, { lineId: "b", marks: 2 }] },
        { id: Q2, questionText: "Q2", lines: [{ lineId: "c", marks: 6 }] },
      ],
      answerKey: [
        { questionId: Q1, lineId: "a" },
        { questionId: Q2, lineId: "c" },
      ],
      total: 10,
    };
  },
}));

describe("ensureExerciseQuestionTestBoard", () => {
  it("stores a bare uuid key and its own kind", async () => {
    existing = [];
    inserts.length = 0;
    upserts.length = 0;
    const { ensureExerciseQuestionTestBoard, COURSE_EXERCISE_TEST_KIND } = await import("../exerciseBoard");
    const board = await ensureExerciseQuestionTestBoard("b1", Q2);

    expect(board.assessmentId).toBe("a-new");
    expect(board.classId).toBe("hidden-class");
    expect(board.question.id).toBe(Q2);
    expect(board.total).toBe(6);
    expect(board.sittingId).toBeTruthy();

    const created = inserts.find((i) => i.table === "assessments");
    expect(created.row.question_key).toBe(Q2);
    expect(created.row.question_key).not.toContain(":");
    expect(created.row.kind).toBe(COURSE_EXERCISE_TEST_KIND);
    expect(created.row.questions).toHaveLength(1);

    // Only this question's lines travel in the answer key.
    const key = upserts.find((u) => u.table === "assessment_answer_keys");
    expect(key.row.lines).toEqual([{ questionId: Q2, lineId: "c" }]);
  });

  it("reuses the existing container instead of creating a second one", async () => {
    existing = [{ id: "a-old" }];
    inserts.length = 0;
    const { ensureExerciseQuestionTestBoard } = await import("../exerciseBoard");
    const board = await ensureExerciseQuestionTestBoard("b1", Q1);

    expect(board.assessmentId).toBe("a-old");
    expect(inserts.find((i) => i.table === "assessments")).toBeUndefined();
  });

  it("refuses a question id that is not a uuid", async () => {
    existing = [];
    const { ensureExerciseQuestionTestBoard } = await import("../exerciseBoard");
    await expect(ensureExerciseQuestionTestBoard("b1", "not-a-uuid")).rejects.toThrow();
  });
});
