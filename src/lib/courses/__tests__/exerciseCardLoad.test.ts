// Opening an Exercise Card must cost ONE compile per distinct lesson-note
// section, never one per link, and must keep every link in card order.
import { beforeEach, describe, expect, it, vi } from "vitest";

const links = [
  { id: "l2", block_id: "b1", position: 1, total_marks: 6, section_id: "s1", subsection_id: "q2", label: "Q2" },
  { id: "l1", block_id: "b1", position: 0, total_marks: 4, section_id: "s1", subsection_id: "q1", label: "Q1" },
  { id: "l3", block_id: "b1", position: 2, total_marks: 5, section_id: "s2", subsection_id: "gone", label: "Q3" },
];

const query = (rows: unknown) => {
  const q: any = {
    select: () => q,
    eq: () => q,
    maybeSingle: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows, error: null }),
    then: (res: (v: { data: unknown; error: null }) => unknown) => Promise.resolve({ data: rows, error: null }).then(res),
  };
  return q;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "course_exercise_questions") return query(links);
      if (table === "course_blocks") return query([{ config: { name: "Algebra drill", passMark: 70 } }]);
      return query([]);
    },
  },
}));

const compileCalls: string[] = [];
vi.mock("@/lib/assessments/createAssessment", () => ({
  compileSectionQuestions: async (sectionId: string) => {
    compileCalls.push(sectionId);
    if (sectionId !== "s1") return { questions: [], answerKey: [], total: 0 };
    return {
      questions: [
        { id: "q1", questionText: "Q1", lines: [{ lineId: "a", marks: 2 }, { lineId: "b", marks: 2 }] },
        { id: "q2", questionText: "Q2", lines: [{ lineId: "c", marks: 6 }] },
      ],
      answerKey: [{ questionId: "q1", lineId: "a" }],
      total: 10,
    };
  },
}));

describe("loadExerciseCard", () => {
  beforeEach(() => { compileCalls.length = 0; });

  it("compiles each section once and keeps every link, in card order", async () => {
    const { loadExerciseCard } = await import("../exerciseBoard");
    const card = await loadExerciseCard("b1");

    expect(compileCalls.sort()).toEqual(["s1", "s2"]);
    expect(card.title).toBe("Algebra drill");
    expect(card.entries.map((e) => e.linkId)).toEqual(["l1", "l2", "l3"]);
    // Unresolvable link keeps its saved marks and is flagged, never dropped.
    expect(card.entries[2].missing).toBe(true);
    expect(card.total).toBe(4 + 6 + 5);
  });

  it("paints the shell from links alone, without compiling any note", async () => {
    const { loadExerciseCardShell } = await import("../exerciseBoard");
    const shell = await loadExerciseCardShell("b1");
    expect(compileCalls).toEqual([]);
    expect(shell.entries.map((e) => e.questionId)).toEqual(["q1", "q2", "gone"]);
    expect(shell.total).toBe(15);
  });
});
