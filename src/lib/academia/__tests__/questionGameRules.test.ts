import { describe, expect, it, vi } from "vitest";
import {
  QuestionGameLinkError,
  gameActionLabel,
  gameCover,
  gameIdPatch,
  selectableQuestionGames,
  linkQuestionGame,
  questionAcceptsGameLink,
  showAddGameControl,
  withGameLink,
  type GameLinkStore,
  type QuestionGameActivity,
} from "../questionGameRules";

const floating = (
  patch: Partial<QuestionGameActivity> = {},
): QuestionGameActivity => ({
  id: "q1",
  kind: "question",
  sessionId: "session",
  assessmentId: "assessment",
  subsectionId: "subsection",
  notebookId: "notebook",
  classId: "class",
  gameId: null,
  floatingLineCount: 3,
  multipleChoice: false,
  ...patch,
});

describe("who can add a game", () => {
  it("accepts a Floating Numbers question with or without a game", () => {
    expect(questionAcceptsGameLink(floating())).toBe(true);
    expect(questionAcceptsGameLink(floating({ gameId: "game-a" }))).toBe(true);
    expect(questionAcceptsGameLink(floating({ floatingLineCount: null }))).toBe(
      true,
    );
  });

  it("rejects an ordinary multiple-choice question", () => {
    expect(
      questionAcceptsGameLink(floating({ kind: "mcq", multipleChoice: true })),
    ).toBe(false);
    expect(
      questionAcceptsGameLink(
        floating({ kind: "mcq", multipleChoice: false, floatingLineCount: 4 }),
      ),
    ).toBe(false);
    expect(
      questionAcceptsGameLink({
        kind: "mcq",
        assessmentId: null,
        subsectionId: "subsection",
        floatingLineCount: null,
        multipleChoice: true,
      }),
    ).toBe(false);
  });

  it("rejects other activity kinds and questions with no Floating Numbers", () => {
    for (const kind of ["adventure", "game", "lesson_note", "smartboard"]) {
      expect(questionAcceptsGameLink(floating({ kind }))).toBe(false);
    }
    expect(questionAcceptsGameLink(floating({ floatingLineCount: 0 }))).toBe(
      false,
    );
    expect(questionAcceptsGameLink(floating({ assessmentId: null }))).toBe(
      false,
    );
    expect(questionAcceptsGameLink(floating({ subsectionId: null }))).toBe(
      false,
    );
  });

  it("names Add Game until a game is linked, then Change Game", () => {
    expect(gameActionLabel(null)).toBe("Add Game");
    expect(gameActionLabel("game-a")).toBe("Change Game");
  });

  it("lists the teacher's own games and shared templates, not other private games", () => {
    const games = selectableQuestionGames(
      [
        { id: "mine", ownerId: "teacher", library: false },
        { id: "template", ownerId: "admin", library: true },
        { id: "theirs", ownerId: "other", library: false },
        { id: "mine", ownerId: "teacher", library: false },
      ],
      "teacher",
    );
    expect(games.map((game) => game.id)).toEqual(["mine", "template"]);
  });

  it("shows the control only to someone who may edit an eligible question", () => {
    expect(showAddGameControl({ eligible: true, canEdit: true })).toBe(true);
    expect(showAddGameControl({ eligible: true, canEdit: false })).toBe(false);
    expect(showAddGameControl({ eligible: false, canEdit: true })).toBe(false);
  });
});

describe("the saved link", () => {
  it("writes only the game id", () => {
    expect(gameIdPatch("game-b")).toEqual({ game_id: "game-b" });
    expect(Object.keys(gameIdPatch("game-b"))).toEqual(["game_id"]);
  });

  it("changes one question and leaves a shared game on the others", () => {
    const questions = [
      { id: "q1", gameId: "game-a", title: "One", tier: "beginner" },
      { id: "q2", gameId: "game-a", title: "Two", tier: "beginner" },
      { id: "q4", gameId: null, title: "Four", tier: "expert" },
    ];
    const next = withGameLink(questions, "q1", "game-b");
    expect(next[0]).toMatchObject({
      id: "q1",
      gameId: "game-b",
      title: "One",
      tier: "beginner",
    });
    expect(next[1]).toEqual(questions[1]);
    expect(withGameLink(next, "q4", "game-c")[2]).toMatchObject({
      id: "q4",
      gameId: "game-c",
    });
    expect(withGameLink(next, "q4", "game-c")[0].gameId).toBe("game-b");
  });

  it("uses a picture preview when the game has one, otherwise its surface", () => {
    expect(
      gameCover({
        backgroundSrc: "https://cdn.example/cover.png",
        surfaceTexture: "/stone.jpg",
      }),
    ).toBe("https://cdn.example/cover.png");
    expect(
      gameCover({ backgroundSrc: "asset:local", surfaceTexture: "/stone.jpg" }),
    ).toBe("/stone.jpg");
    expect(gameCover({ backgroundSrc: null, surfaceTexture: null })).toBeNull();
  });
});

function memory(
  activity: QuestionGameActivity,
  opts?: {
    canManage?: boolean;
    owns?: boolean;
    shared?: boolean;
    save?: boolean;
    attach?: boolean;
  },
) {
  const saved = { ...activity };
  const attach = vi.fn(async () => opts?.attach !== false);
  const saveGameId = vi.fn(async (_id: string, gameId: string) => {
    if (opts?.save === false) return false;
    saved.gameId = gameId;
    return true;
  });
  const detach = vi.fn(async () => undefined);
  const store: GameLinkStore = {
    userId: async () => "teacher",
    load: async () => ({ ...saved }),
    canManage: async () => opts?.canManage !== false,
    ownsGame: async () => opts?.owns !== false,
    attach,
    saveGameId,
    othersStillUse: async () => opts?.shared === true,
    detach,
  };
  return { saved, attach, saveGameId, detach, store };
}

describe("linkQuestionGame", () => {
  it("adds a game to a question that has none", async () => {
    const mem = memory(floating());
    const result = await linkQuestionGame("q1", "game-b", mem.store);
    expect(result).toEqual({
      gameId: "game-b",
      changed: true,
      previousGameId: null,
    });
    expect(mem.attach).toHaveBeenCalledOnce();
    expect(mem.saveGameId).toHaveBeenCalledWith("q1", "game-b");
    expect(mem.detach).not.toHaveBeenCalled();
    expect(mem.saved.gameId).toBe("game-b");
  });

  it("replaces the game and drops the old link only for this question", async () => {
    const mem = memory(floating({ gameId: "game-a" }));
    const result = await linkQuestionGame("q1", "game-b", mem.store);
    expect(result.previousGameId).toBe("game-a");
    expect(mem.saved.gameId).toBe("game-b");
    expect(mem.detach).toHaveBeenCalledTimes(1);
    expect(mem.detach).toHaveBeenCalledWith(
      expect.objectContaining({ id: "q1", gameId: "game-a" }),
      "game-a",
    );
  });

  it("keeps a game that another question still uses", async () => {
    const mem = memory(floating({ gameId: "game-a" }), { shared: true });
    await linkQuestionGame("q1", "game-b", mem.store);
    expect(mem.detach).not.toHaveBeenCalled();
    expect(mem.saved.gameId).toBe("game-b");
  });

  it("rejects a multiple-choice question before anything is written", async () => {
    const mem = memory(floating({ kind: "mcq", multipleChoice: true }));
    await expect(
      linkQuestionGame("q1", "game-b", mem.store),
    ).rejects.toMatchObject({ reason: "not_eligible" });
    expect(mem.attach).not.toHaveBeenCalled();
    expect(mem.saveGameId).not.toHaveBeenCalled();
    expect(mem.saved.gameId).toBeNull();
  });

  it("rejects a student before anything is written", async () => {
    const mem = memory(floating({ gameId: "game-a" }), { canManage: false });
    await expect(
      linkQuestionGame("q1", "game-b", mem.store),
    ).rejects.toBeInstanceOf(QuestionGameLinkError);
    await expect(
      linkQuestionGame("q1", "game-b", mem.store),
    ).rejects.toMatchObject({ reason: "not_allowed" });
    expect(mem.attach).not.toHaveBeenCalled();
    expect(mem.saved.gameId).toBe("game-a");
  });

  it("keeps the previous game when saving fails", async () => {
    const mem = memory(floating({ gameId: "game-a" }), { save: false });
    await expect(
      linkQuestionGame("q1", "game-b", mem.store),
    ).rejects.toMatchObject({ reason: "save_failed" });
    expect(mem.saved.gameId).toBe("game-a");
    expect(mem.detach).toHaveBeenCalledWith(
      expect.objectContaining({ id: "q1" }),
      "game-b",
    );
  });

  it("keeps the new game if clearing the old link fails", async () => {
    const mem = memory(floating({ gameId: "game-a" }));
    mem.detach.mockRejectedValueOnce(new Error("cleanup failed"));
    const result = await linkQuestionGame("q1", "game-b", mem.store);
    expect(result.changed).toBe(true);
    expect(mem.saved.gameId).toBe("game-b");
  });

  it("does not offer someone else's game", async () => {
    const mem = memory(floating(), { owns: false });
    await expect(
      linkQuestionGame("q1", "theirs", mem.store),
    ).rejects.toMatchObject({ reason: "not_your_game" });
    expect(mem.attach).not.toHaveBeenCalled();
  });
});
