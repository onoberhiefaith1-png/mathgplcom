import { beforeEach, describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({
  failure: "",
  blockRequests: [] as string[][],
  sections: [{ id: "sec", notebook_id: "note", kind: "exercise", title: "Practice", order_index: 0 }],
  subs: [
    { id: "first", section_id: "sec", order_index: 0 },
    { id: "second", section_id: "sec", order_index: 1 },
    { id: "outside", section_id: "other", order_index: 0 },
  ],
  blocks: [
    { subsection_id: "first", kind: "problem", content_ascii: "Which is even?\nA. 1\nB. 2\nCorrect Answer: B" },
    { subsection_id: "second", kind: "problem", content_ascii: "Which is odd?\nA. 3\nB. 4\nCorrect Answer: A" },
  ],
}));

vi.mock("@/lib/db/scope", () => ({
  db: () => ({
    from: (table: string) => {
      const rows = table === "notebook_sections" ? data.sections :
        table === "notebook_subsections" ? data.subs : data.blocks;
      let selected: Record<string, unknown>[] = [...rows];
      const response = () => data.failure === table
        ? { data: null, error: { code: "42501" } }
        : { data: selected, error: null };
      const query = {
        select: () => query,
        order: () => query,
        eq: (key: string, value: unknown) => {
          selected = selected.filter((row) => row[key] === value);
          return query;
        },
        in: (key: string, ids: string[]) => {
          data.blockRequests.push(ids);
          selected = selected.filter((row) => ids.includes(String(row[key])));
          return query;
        },
        maybeSingle: async () => ({ ...response(), data: response().data?.[0] ?? null }),
        then: (resolve: (value: ReturnType<typeof response>) => void) => Promise.resolve(response()).then(resolve),
      };
      return query;
    },
  }),
}));
vi.mock("@/lib/smartboard/presentation", () => ({
  buildLessonBoardSource: () => ({ beats: [], reservoirs: [] }),
}));

import { compileSectionQuestions } from "../createAssessment";

beforeEach(() => { data.failure = ""; data.blockRequests = []; });

describe("selected question payload", () => {
  it("keeps sibling questions, options and answer keys separate", async () => {
    const first = await compileSectionQuestions("sec", "first");
    const second = await compileSectionQuestions("sec", "second");
    expect(data.blockRequests).toEqual([["first"], ["second"]]);
    expect(first.questions.map((q) => [q.id, q.mcq?.options.map((option) => option.text), q.mcq?.answer]))
      .toEqual([["first", ["1", "2"], "B"]]);
    expect(second.questions.map((q) => [q.id, q.mcq?.options.map((option) => option.text), q.mcq?.answer]))
      .toEqual([["second", ["3", "4"], "A"]]);
    expect(first.answerKey.map((line) => line.questionId)).toEqual(["first"]);
    expect(second.answerKey.map((line) => line.questionId)).toEqual(["second"]);
  });

  it("does not fall back to sibling content for a stale or foreign question ID", async () => {
    expect((await compileSectionQuestions("sec", "outside")).questions).toEqual([]);
    expect(data.blockRequests).toEqual([]);
  });

  it("preserves full section compilation for callers that need it", async () => {
    expect((await compileSectionQuestions("sec")).questions.map((q) => q.id)).toEqual(["first", "second"]);
  });

  it("surfaces a denied read instead of converting it into an empty question", async () => {
    data.failure = "notebook_subsections";
    await expect(compileSectionQuestions("sec", "second")).rejects.toMatchObject({ code: "42501" });
  });
});
