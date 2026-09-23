import { describe, expect, it } from "vitest";

import {
  contextFromPath,
  contextPrompt,
  mergeContext,
  readAuraScreenContext,
  setAuraScreenContext,
} from "../context";

describe("knowing where the teacher is", () => {
  it("reads the class, lesson, game and student off the address", () => {
    expect(contextFromPath("/teaching-hub/classes/c1/students/s2").classId).toBe("c1");
    expect(contextFromPath("/teaching-hub/classes/c1/students/s2").studentId).toBe("s2");
    expect(contextFromPath("/lesson-notes/n7").notebookId).toBe("n7");
    expect(contextFromPath("/lesson-notes/n7/floating/sub3").subsectionId).toBe("sub3");
    expect(contextFromPath("/game/slate/g9").slateGameId).toBe("g9");
    expect(contextFromPath("/adventure/games/a4").adventureId).toBe("a4");
  });

  it("does not mistake a page name for a record", () => {
    expect(contextFromPath("/teaching-hub/classes/create").classId).toBeUndefined();
    expect(contextFromPath("/lesson-notes").notebookId).toBeUndefined();
  });

  it("drops the query string", () => {
    expect(contextFromPath("/lesson-notes/n7?tab=notes").path).toBe("/lesson-notes/n7");
  });

  it("lets the open screen add what the address cannot say", () => {
    const merged = mergeContext(contextFromPath("/teaching-hub/classes/c1/smartboard"), {
      className: "Grade 9 Mathematics",
      questionLine: 3,
      selectedChips: ["5x", "+ 3"],
      notes: [""],
    });
    const prompt = contextPrompt(merged)!;
    expect(prompt).toContain("Grade 9 Mathematics");
    expect(prompt).toContain("Line being worked on: 3");
    expect(prompt).toContain("5x, + 3");
    expect(prompt).toContain('If they say "this class"');
  });

  it("says nothing at all when nothing is known", () => {
    expect(contextPrompt(null)).toBeNull();
    expect(contextPrompt({})).toBeNull();
  });

  it("remembers, then forgets, what a screen reported", () => {
    setAuraScreenContext({ className: "Grade 7" });
    expect(readAuraScreenContext().className).toBe("Grade 7");
    setAuraScreenContext(null);
    expect(readAuraScreenContext()).toEqual({});
  });
});
