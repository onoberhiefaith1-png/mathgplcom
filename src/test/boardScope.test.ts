import { describe, it, expect } from "vitest";
import { buildBoardScope, boardKey } from "@/lib/smartboard/boardScope";

const base = {
  studentId: "stu-1",
  classId: "class-A",
  workspace: "assignment" as const,
  assessmentId: "assess-1",
  questionId: "q1",
  notebookId: "note-1",
};

describe("board scope isolation", () => {
  it("is stable for the same board", () => {
    expect(buildBoardScope(base)).toBe(buildBoardScope({ ...base }));
  });

  it("differs per question", () => {
    expect(buildBoardScope(base)).not.toBe(buildBoardScope({ ...base, questionId: "q2" }));
  });

  it("differs per class", () => {
    expect(buildBoardScope(base)).not.toBe(buildBoardScope({ ...base, classId: "class-B" }));
  });

  it("differs per student", () => {
    expect(buildBoardScope(base)).not.toBe(buildBoardScope({ ...base, studentId: "stu-2" }));
  });

  it("differs per workspace and per adventure game", () => {
    expect(buildBoardScope(base)).not.toBe(buildBoardScope({ ...base, workspace: "adventure" }));
    expect(buildBoardScope({ ...base, workspace: "adventure", gameId: "g1" })).not.toBe(
      buildBoardScope({ ...base, workspace: "adventure", gameId: "g2" }),
    );
  });

  it("keeps the legacy notebook shape for the lesson smartboard", () => {
    expect(buildBoardScope({ notebookId: "note-1" })).toBe("notebook:note-1");
  });

  it("namespaces storage buckets", () => {
    const a = boardKey("smartlines", buildBoardScope(base));
    const b = boardKey("smartlines", buildBoardScope({ ...base, questionId: "q2" }));
    expect(a).not.toBe(b);
    expect(a.startsWith("smartboard:smartlines:")).toBe(true);
  });
});
