import { describe, expect, it } from "vitest";
import { splitQuestionObjects } from "@/lib/assessments/questionObjects";
import { buildAssessmentBoardSource } from "@/lib/assessments/assessmentBoardSource";
import { compileOfflineBoard } from "@/lib/offline/academiaPack";
import type { SolutionObject } from "@/lib/floating/solutionItems";

const diagram = (objId: string, extra: Partial<SolutionObject> = {}): SolutionObject => ({
  objId, nodeType: "geometryDiagram", family: "diagram", label: "Diagram", attrs: {}, afterLine: 0, ...extra,
});

describe("question diagrams", () => {
  it("keeps the question's diagram on the question, not Line 1", () => {
    const { question, notes } = splitQuestionObjects([diagram("q")], 3);
    expect(question.map((o) => o.objId)).toEqual(["q"]);
    expect(notes.size).toBe(0);
  });

  it("makes a solution diagram a note on the line it follows", () => {
    const { question, notes } = splitQuestionObjects([diagram("s", { inSolution: true, afterLine: 2 })], 3);
    expect(question).toHaveLength(0);
    expect(notes.get(2)?.map((o) => o.objId)).toEqual(["s"]);
  });

  it("puts the diagram on the question beat of an assignment board", () => {
    const src = buildAssessmentBoardSource({
      id: "a", title: "T",
      questions: [{ id: "q1", questionText: "Find x", objects: [diagram("q")], lines: [{ lineId: "l1", chips: ["x"], marks: 1 }] }],
    });
    expect(src.beats[0].objects?.map((o) => o.objId)).toEqual(["q"]);
    expect(src.reservoirs[0].lines).toHaveLength(1);
  });

  it("carries the diagram into the offline Practice/Play board", () => {
    const board = compileOfflineBoard({
      activityId: "a", subsectionId: "s", title: "T", questionText: "Find x",
      lines: [{ equation: "x = 2", marks: 1 } as any],
      objects: [diagram("q")],
    });
    expect(board?.boardSource.beats[0].objects?.map((o) => o.objId)).toEqual(["q"]);
  });
});
