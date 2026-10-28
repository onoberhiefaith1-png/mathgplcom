// An Exercise Card question that already has its own frozen copy must be served
// from that copy — the Lesson Note is never compiled again, so editing, moving
// or deleting the note cannot change what students solve.
import { describe, expect, it, vi } from "vitest";

const links = [
  {
    id: "l1",
    block_id: "b1",
    position: 0,
    total_marks: 3,
    notebook_id: "n1",
    section_id: "s1",
    subsection_id: "q1",
    label: "Q1",
    assigned_question_id: "copy-1",
  },
];

const frozenQuestion = {
  id: "q1",
  questionText: "Solve 2x + 3 = 9",
  lines: [
    {
      lineId: "a",
      marks: 2,
      chips: ["2x", "=", "6"],
      containers: ["term", "operator", "term"],
      note: "Subtract 3 from both sides",
      table: { objectId: "t1", grid: [["x", "y"]] },
    },
    { lineId: "b", marks: 1, chips: ["x", "=", "3"], containers: ["term", "operator", "term"], noteOnly: false },
  ],
};

const query = (rows: unknown) => {
  const q: any = {
    select: () => q,
    eq: () => q,
    in: () => q,
    maybeSingle: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows, error: null }),
    then: (res: (v: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(res),
  };
  return q;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (table: string) => {
      if (table === "course_exercise_questions") return query(links);
      if (table === "course_blocks") return query([{ config: { name: "Algebra drill", passMark: 70 } }]);
      if (table === "assigned_questions") {
        return query([{ id: "copy-1", question: frozenQuestion, total_marks: 3, label: "Q1" }]);
      }
      if (table === "assigned_question_keys") {
        return query([
          { assigned_question_id: "copy-1", lines: [{ questionId: "q1", lineId: "a", tokens: ["2x", "=", "6"] }] },
        ]);
      }
      return query([]);
    },
  },
}));

const compileCalls: string[] = [];
vi.mock("@/lib/assessments/createAssessment", () => ({
  compileSectionQuestions: async (sectionId: string) => {
    compileCalls.push(sectionId);
    // The note was edited after the question was handed out.
    return {
      questions: [{ id: "q1", questionText: "Solve 5x = 50", lines: [{ lineId: "z", marks: 9 }] }],
      answerKey: [{ questionId: "q1", lineId: "z" }],
      total: 9,
    };
  },
}));

describe("Exercise Card questions are independent of the Lesson Note", () => {
  it("serves the frozen copy and never compiles the note", async () => {
    const { loadExerciseCard } = await import("../exerciseBoard");
    const card = await loadExerciseCard("b1");

    expect(compileCalls).toEqual([]);
    expect(card.entries).toHaveLength(1);
    const entry = card.entries[0];
    expect(entry.missing).toBe(false);
    expect(entry.payload?.questionText).toBe("Solve 2x + 3 = 9");
    // Every floating chip, container, note and table workspace survives.
    expect(entry.payload?.lines[0].chips).toEqual(["2x", "=", "6"]);
    expect(entry.payload?.lines[0].containers).toEqual(["term", "operator", "term"]);
    expect(entry.payload?.lines[0].note).toBe("Subtract 3 from both sides");
    expect((entry.payload?.lines[0] as { table?: unknown }).table).toBeTruthy();
    // Marks come from the copy, not from the edited note.
    expect(entry.marks).toBe(3);
    expect(card.total).toBe(3);
  });
});
