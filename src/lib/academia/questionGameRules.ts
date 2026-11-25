/**
 * Add or change the Game linked to one Academia question.
 * The question and the Game stay separate records. Only this question's
 * game id changes. Practice keeps the Smartboard. Play reads the new id.
 */

export type QuestionGameActivity = {
  id: string;
  kind: string;
  sessionId: string;
  assessmentId: string | null;
  subsectionId: string | null;
  notebookId: string | null;
  classId: string | null;
  gameId: string | null;
  /** Saved Floating Numbers lines. Null means the count could not be read. */
  floatingLineCount: number | null;
  multipleChoice: boolean;
};

/** Floating Numbers on the Smartboard. Ordinary multiple-choice and other kinds are excluded. */
export function questionAcceptsGameLink(
  activity: Pick<
    QuestionGameActivity,
    | "kind"
    | "assessmentId"
    | "subsectionId"
    | "floatingLineCount"
    | "multipleChoice"
  >,
): boolean {
  if (activity.multipleChoice || activity.kind === "mcq") return false;
  if (activity.kind !== "question") return false;
  if (!activity.assessmentId || !activity.subsectionId) return false;
  if (activity.floatingLineCount === 0) return false;
  return true;
}

/** One control for teachers who may edit. Students and other viewers never see it. */
export function showAddGameControl(opts: {
  eligible: boolean;
  canEdit: boolean;
}): boolean {
  return opts.eligible && opts.canEdit;
}

/** The only column this feature writes on the question. */
export function gameIdPatch(gameId: string): { game_id: string } {
  return { game_id: gameId };
}

export function gameCover(input: {
  backgroundSrc?: string | null;
  surfaceTexture?: string | null;
}): string | null {
  const src = input.backgroundSrc ?? "";
  if (/^(https?:|data:|blob:|\/)/.test(src)) return src;
  return input.surfaceTexture || null;
}

/** Point one question at a game and leave every other question's link alone. */
export function withGameLink<T extends { id: string; gameId: string | null }>(
  questions: readonly T[],
  activityId: string,
  gameId: string,
): T[] {
  return questions.map((question) =>
    question.id === activityId ? { ...question, gameId } : question,
  );
}

export type GameLinkFailure =
  | "not_signed_in"
  | "not_found"
  | "not_allowed"
  | "not_eligible"
  | "not_your_game"
  | "not_ready"
  | "attach_failed"
  | "save_failed";

const FAILURE_MESSAGE: Record<GameLinkFailure, string> = {
  not_signed_in: "Please sign in again.",
  not_found: "This question could not be found.",
  not_allowed: "You can't change this question's game.",
  not_eligible: "Add Game is only for Floating Numbers questions.",
  not_your_game: "Choose a game from your own dashboard.",
  not_ready: "This question is not ready for a game.",
  attach_failed:
    "This question could not be added to the game. Nothing was changed.",
  save_failed: "The game could not be saved. This question is unchanged.",
};

export class QuestionGameLinkError extends Error {
  readonly reason: GameLinkFailure;
  constructor(reason: GameLinkFailure) {
    super(FAILURE_MESSAGE[reason]);
    this.name = "QuestionGameLinkError";
    this.reason = reason;
  }
}

export type GameLinkStore = {
  userId: () => Promise<string | null>;
  load: (activityId: string) => Promise<QuestionGameActivity | null>;
  canManage: (
    activity: QuestionGameActivity,
    userId: string,
  ) => Promise<boolean>;
  ownsGame: (gameId: string, userId: string) => Promise<boolean>;
  attach: (activity: QuestionGameActivity, gameId: string) => Promise<boolean>;
  saveGameId: (activityId: string, gameId: string) => Promise<boolean>;
  /** Another question in this class still plays this game for the same sums. */
  othersStillUse: (
    activity: QuestionGameActivity,
    gameId: string,
  ) => Promise<boolean>;
  detach: (activity: QuestionGameActivity, gameId: string) => Promise<void>;
};

export type GameLinkResult = {
  gameId: string;
  changed: boolean;
  previousGameId: string | null;
};

async function rollbackNewLink(
  activity: QuestionGameActivity,
  gameId: string,
  store: GameLinkStore,
) {
  try {
    if (await store.othersStillUse(activity, gameId)) return;
    await store.detach(activity, gameId);
  } catch {
    // The question row still names the previous game, so Play is unchanged.
  }
}

/**
 * Link `gameId` to one question. On a failed save the previous game id remains
 * and the new membership is removed when no other question is using it.
 */
export async function linkQuestionGame(
  activityId: string,
  gameId: string,
  store: GameLinkStore,
): Promise<GameLinkResult> {
  const userId = await store.userId();
  if (!userId) throw new QuestionGameLinkError("not_signed_in");
  const activity = await store.load(activityId);
  if (!activity) throw new QuestionGameLinkError("not_found");
  if (!(await store.canManage(activity, userId)))
    throw new QuestionGameLinkError("not_allowed");
  if (!questionAcceptsGameLink(activity))
    throw new QuestionGameLinkError("not_eligible");
  if (!gameId) throw new QuestionGameLinkError("not_your_game");
  if (activity.gameId === gameId) {
    return { gameId, changed: false, previousGameId: activity.gameId };
  }
  if (!(await store.ownsGame(gameId, userId)))
    throw new QuestionGameLinkError("not_your_game");
  if (!activity.classId || !activity.subsectionId || !activity.notebookId) {
    throw new QuestionGameLinkError("not_ready");
  }

  let attached = false;
  try {
    attached = await store.attach(activity, gameId);
    if (!attached) throw new QuestionGameLinkError("attach_failed");
    const saved = await store.saveGameId(activity.id, gameId);
    if (!saved) throw new QuestionGameLinkError("save_failed");
  } catch (error) {
    if (attached) await rollbackNewLink(activity, gameId, store);
    throw error;
  }

  const previous = activity.gameId;
  if (previous && previous !== gameId) {
    try {
      // Leave the old game in place when another question still plays it.
      if (!(await store.othersStillUse(activity, previous))) {
        await store.detach(activity, previous);
      }
    } catch {
      // The question already names the new game, so Play uses that.
    }
  }
  return { gameId, changed: true, previousGameId: previous };
}
