import { expect, it } from "vitest";
import { compileOfflineBoard } from "../academiaPack";
import { compileInlineMcq } from "@/lib/assessments/compileInlineMcq";
const source = "Constant term in 4x + 7?\nA. −7\nB. 7\nC. 4x\nD. 4\nCorrect Answer: B";
it("uses the same question, options and single mark online and offline without floating lines", () => {
  const online = compileInlineMcq(source, "sub-q")!;
  const offline = compileOfflineBoard({ activityId: "activity", subsectionId: "sub", title: "Constant term", questionText: source, lines: [] })!;
  expect(offline).not.toBeNull();
  expect(offline.totalMarks).toBe(online.total);
  expect(offline.boardSource.beats[0].mcq).toEqual(online.question.mcq);
  expect(offline.boardSource.reservoirs[0].lines[0].equation).toBe(online.answerKey.equationAscii);
  expect(offline.lineHasFloatingNumbers).toEqual([false]);
});
