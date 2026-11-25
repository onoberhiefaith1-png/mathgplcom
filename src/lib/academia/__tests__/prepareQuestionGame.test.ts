import { describe, expect, it, vi } from "vitest";
import {
  QUESTION_NOT_READY,
  boardsForActivity,
  prepareAcademiaQuestionGame,
  type PrepareQuestionDeps,
} from "../prepareQuestionGame";

const activity = {
  id: "activity",
  kind: "question",
  classId: "class",
  subsectionId: "sums",
  notebookId: "note",
  gameId: null as string | null,
};

function deps(boards: { subsectionId: string }[]): PrepareQuestionDeps & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    loadActivity: async () => ({ ...activity }),
    assignGameToClass: async (gameId, classId) => {
      calls.push(`assign:${gameId}:${classId}`);
    },
    assignQuestion: async (gameId, notebookId, subsectionId, classId) => {
      calls.push(`question:${gameId}:${notebookId}:${subsectionId}:${classId}`);
      return true;
    },
    ensureGameBoards: async (gameId, classId) => {
      calls.push(`boards:${gameId}:${classId}`);
      return boards;
    },
  };
}

describe("Play's not-ready check", () => {
  it("reproduces the game screen when a link has no compiled board", () => {
    // Add Game used to save only the game id. Play then shows the game name
    // and "This question is not ready in the Game yet."
    expect(boardsForActivity([], "sums")).toEqual([]);
    expect(boardsForActivity([{ subsectionId: "other" }], "sums")).toEqual([]);
  });

  it("is ready only when the compiled board is this question", () => {
    expect(boardsForActivity([{ subsectionId: "sums" }, { subsectionId: "other" }], "sums"))
      .toEqual([{ subsectionId: "sums" }]);
  });
});

describe("prepareAcademiaQuestionGame", () => {
  it("writes the class question and compiles its board, like Assign with a game", async () => {
    const store = deps([{ subsectionId: "sums" }]);
    const ready = await prepareAcademiaQuestionGame("activity", "game-b", store);
    expect(store.calls).toEqual([
      "assign:game-b:class",
      "question:game-b:note:sums:class",
      "boards:game-b:class",
    ]);
    expect(ready).toEqual([{ subsectionId: "sums" }]);
  });

  it("repairs a question already linked, without asking the teacher to add it again", async () => {
    activity.gameId = "game-b";
    const store = deps([{ subsectionId: "sums" }]);
    await prepareAcademiaQuestionGame("activity", "game-b", store);
    expect(store.calls[0]).toBe("assign:game-b:class");
    expect(store.calls).toContain("boards:game-b:class");
  });

  it("prepares the newly chosen game when the link changes", async () => {
    activity.gameId = "game-a";
    const store = deps([{ subsectionId: "sums" }]);
    await prepareAcademiaQuestionGame("activity", "game-c", store);
    expect(store.calls[0]).toBe("assign:game-c:class");
    expect(store.calls.join(" ")).not.toContain("game-a");
  });

  it("does not report success when Play would still have no board", async () => {
    const store = deps([{ subsectionId: "other" }]);
    await expect(prepareAcademiaQuestionGame("activity", "game-b", store)).rejects.toThrow(QUESTION_NOT_READY);
    expect(store.calls).toContain("boards:game-b:class");
  });

  it("does not report success when the question could not be added", async () => {
    const store = deps([{ subsectionId: "sums" }]);
    store.assignQuestion = vi.fn(async () => false);
    await expect(prepareAcademiaQuestionGame("activity", "game-b", store)).rejects.toThrow(/could not be added/);
    expect(store.calls).not.toContain("boards:game-b:class");
  });
});
