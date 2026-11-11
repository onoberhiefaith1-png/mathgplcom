import { describe, it, expect } from "vitest";
import { emptyAssignPath, selectAssignLevel } from "../cascadeSelect";

describe("Academia assign path", () => {
  it("applies a class tap immediately and clears the levels below", () => {
    const started = { classId: "c1", subjectId: "s1", topicId: "t1", subtopicId: "u1", sessionId: "se1" };
    const next = selectAssignLevel(started, "classId", "c2");
    expect(next).toEqual({ classId: "c2", subjectId: "", topicId: "", subtopicId: "", sessionId: "" });
  });

  it("keeps the year/class when the teacher taps a subject", () => {
    const next = selectAssignLevel({ ...emptyAssignPath(), classId: "c1" }, "subjectId", "s1");
    expect(next.classId).toBe("c1");
    expect(next.subjectId).toBe("s1");
    expect(next.topicId).toBe("");
  });
});
