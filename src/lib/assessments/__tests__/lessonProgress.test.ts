import { beforeEach, describe, expect, it, vi } from "vitest";

type ProgressRow = {
  assessment_id: string;
  student_id: string;
  score: number;
  status: string;
};

let rows: ProgressRow[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: (_col: string, ids: string[]) => ({
          data: rows.filter((r) => ids.includes(r.assessment_id)),
        }),
      }),
    }),
  },
}));

const { loadLessonProgress } = await import("../lessonProgress");

const card = [
  { id: "q1", total_marks: 12 },
  { id: "q2", total_marks: 6 },
  { id: "q3", total_marks: 15 },
];
const members = [{ user_id: "s1", display_name: "Faith" }];

beforeEach(() => {
  rows = [];
});

describe("Assignment Card completion", () => {
  it("is not Completed when only one question is done — Inactive off the board", async () => {
    rows = [{ assessment_id: "q1", student_id: "s1", score: 12, status: "completed" }];
    const [row] = await loadLessonProgress(card, members, new Set());
    expect(row.status).toBe("inactive");
  });

  it("is In Progress when partially done and the Smartboard is open", async () => {
    rows = [
      { assessment_id: "q1", student_id: "s1", score: 12, status: "completed" },
      { assessment_id: "q2", student_id: "s1", score: 2, status: "in_progress" },
    ];
    const [row] = await loadLessonProgress(card, members, new Set(["s1"]));
    expect(row.status).toBe("in_progress");
  });

  it("is Completed only when every question in the card is completed", async () => {
    rows = card.map((a) => ({
      assessment_id: a.id,
      student_id: "s1",
      score: a.total_marks,
      status: "completed",
    }));
    const [row] = await loadLessonProgress(card, members, new Set());
    expect(row.status).toBe("completed");
    expect(row.score).toBe(33);
  });

  it("full marks without completion on every question is not Completed", async () => {
    rows = [
      { assessment_id: "q1", student_id: "s1", score: 12, status: "completed" },
      { assessment_id: "q2", student_id: "s1", score: 6, status: "in_progress" },
      { assessment_id: "q3", student_id: "s1", score: 15, status: "in_progress" },
    ];
    const [row] = await loadLessonProgress(card, members, new Set(["s1"]));
    expect(row.status).toBe("in_progress");
  });
});
