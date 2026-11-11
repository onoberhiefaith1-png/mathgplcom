import { describe, expect, it } from "vitest";
import { applyNotebookToAiContext, type LessonAiContext } from "../aiContext";

const seed = (activeSubtopic: string): LessonAiContext => ({
  subject: "Mathematics",
  topic: "Indices",
  activeSubtopic,
  activeSubtopicPos: 1,
  previousSubtopics: [],
});

describe("Copilot and AI Edit follow the open subtopic", () => {
  it("stayed stuck on the first subtopic before forceSubtopic (the old seed-only rule)", () => {
    const stuck = applyNotebookToAiContext(seed("index notation"), { subject: "Mathematics", topic: "Indices", subtopic: "ide" });
    expect(stuck.activeSubtopic).toBe("index notation");
  });

  it("moves Copilot to ide when the drawer opens that lesson", () => {
    const next = applyNotebookToAiContext(seed("index notation"), {
      subject: "Mathematics",
      topic: "Indices",
      subtopic: "ide",
      subtopicId: "ide",
      forceSubtopic: true,
    });
    expect(next.activeSubtopic).toBe("ide");
    expect(next.topic).toBe("Indices");
    expect(next.activeSubtopicPos).toBeNull();
  });
});
