/**
 * Saves an Academia question's game with the same link the Assign picker uses:
 * the question keeps its id, and Play reads academia_activities.game_id.
 */
import { supabase } from "@/integrations/supabase/client";
import { canManageAcademiaActivity } from "@/lib/academia/itemPermissions";
import { linesForQuestion } from "@/lib/academia/adventurePlay";
import {
  gameIdPatch,
  linkQuestionGame,
  type GameLinkStore,
  type QuestionGameActivity,
} from "@/lib/academia/questionGameRules";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type ActivityRow = {
  id: string;
  kind: string;
  session_id: string;
  assessment_id?: string | null;
  subsection_id?: string | null;
  ref_id?: string | null;
  class_id?: string | null;
  game_id?: string | null;
  created_by?: string | null;
};

async function floatingLineCount(
  subsectionId: string | null,
): Promise<number | null> {
  if (!subsectionId) return 0;
  const { data, error } = await db
    .from("notebook_subsections")
    .select("floating_lines")
    .eq("id", subsectionId)
    .maybeSingle();
  // A hidden source note must not look like "no Floating Numbers".
  // Only a row we can read, with an empty line list, counts as zero.
  if (error || !data) return null;
  return linesForQuestion(data.floating_lines, null).length;
}

function toActivity(
  row: ActivityRow,
  lines: number | null,
): QuestionGameActivity {
  return {
    id: row.id,
    kind: row.kind,
    sessionId: row.session_id,
    assessmentId: row.assessment_id ?? null,
    subsectionId: row.subsection_id ?? null,
    notebookId: row.ref_id ?? null,
    classId: row.class_id ?? null,
    gameId: row.game_id ?? null,
    floatingLineCount: lines,
    multipleChoice: row.kind === "mcq",
  };
}

async function loadRow(
  activityId: string,
): Promise<QuestionGameActivity | null> {
  const { data, error } = await db
    .from("academia_activities")
    .select(
      "id, kind, session_id, assessment_id, subsection_id, ref_id, class_id, game_id, created_by",
    )
    .eq("id", activityId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as ActivityRow;
  return toActivity(row, await floatingLineCount(row.subsection_id ?? null));
}

async function attachOwnedGame(
  activity: QuestionGameActivity,
  gameId: string,
): Promise<boolean> {
  if (!activity.classId || !activity.subsectionId || !activity.notebookId)
    return false;
  const shared = await liveStore.othersStillUse(activity, gameId);
  const [{ assignGameToClass }, { assignQuestion }, { ensureGameBoards }] =
    await Promise.all([
      import("@/lib/slate/gameAssignments"),
      import("@/lib/slate/gameQuestions"),
      import("@/lib/slate/gameBoard"),
    ]);
  await assignGameToClass({
    gameId,
    classId: activity.classId,
    passPercentage: 100,
  });
  const joined = await assignQuestion(
    gameId,
    activity.notebookId,
    activity.subsectionId,
    activity.classId,
  );
  if (!joined) return false;
  try {
    await ensureGameBoards({
      gameId,
      classId: activity.classId,
      questionClassId: activity.classId,
    });
  } catch (error) {
    if (!shared) {
      await db
        .from("slate_game_questions")
        .delete()
        .eq("game_id", gameId)
        .eq("class_id", activity.classId)
        .eq("subsection_id", activity.subsectionId);
    }
    throw error;
  }
  return true;
}

/** ok = the database function wrote the link. missing = the function is not installed yet. */
async function setQuestionGame(
  activityId: string,
  gameId: string,
): Promise<"ok" | "missing" | "denied"> {
  const { error } = await db.rpc("academia_set_question_game", {
    _activity: activityId,
    _game: gameId,
  });
  if (!error) return "ok";
  const code = String(error.code ?? "");
  const message = String(error.message ?? "");
  if (
    code === "42883" ||
    code === "PGRST202" ||
    /does not exist|could not find the function/i.test(message)
  ) {
    return "missing";
  }
  if (/not_allowed|not_eligible|not_your_game|not_signed_in|not_found/i.test(message)) {
    return "denied";
  }
  throw new Error(message || "The game could not be saved. This question is unchanged.");
}

async function compileQuestionBoards(activityId: string, gameId: string) {
  const { data } = await db
    .from("academia_activities")
    .select("class_id")
    .eq("id", activityId)
    .maybeSingle();
  const classId = (data as { class_id?: string | null } | null)?.class_id;
  if (!classId) return;
  try {
    const { ensureGameBoards } = await import("@/lib/slate/gameBoard");
    await ensureGameBoards({ gameId, classId, questionClassId: classId });
  } catch {
    // The link is already saved. Play compiles when the class owner opens it.
  }
}

const liveStore: GameLinkStore = {
  async userId() {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  },
  load: loadRow,
  async canManage(activity, userId) {
    const [
      { data: row, error },
      { data: session, error: sessionError },
      { data: org, error: orgError },
    ] = await Promise.all([
      db
        .from("academia_activities")
        .select("created_by, session_id")
        .eq("id", activity.id)
        .maybeSingle(),
      db
        .from("academia_sessions")
        .select("created_by")
        .eq("id", activity.sessionId)
        .maybeSingle(),
      db.rpc("academia_org_of_session", { _session: activity.sessionId }),
    ]);
    if (error) throw new Error(error.message);
    if (sessionError) throw new Error(sessionError.message);
    if (orgError) throw new Error(orgError.message);
    const { data: owner, error: ownerError } = org
      ? await db.rpc("is_org_owner", { _org_id: org })
      : { data: false, error: null };
    if (ownerError) throw new Error(ownerError.message);
    const manages = canManageAcademiaActivity({
      isOrgOwner: owner === true,
      userId,
      activityCreatedBy:
        (row as { created_by?: string | null } | null)?.created_by ?? null,
      sessionCreatedBy:
        (session as { created_by?: string | null } | null)?.created_by ?? null,
    });
    if (manages) return true;
    // Assigned subject teachers may build this Session. Visitors are not assigned.
    const { data: subject, error: subjectError } = await db.rpc(
      "academia_subject_of_session",
      { _session: activity.sessionId },
    );
    if (subjectError) throw new Error(subjectError.message);
    if (!subject) return false;
    const { data: canBuild, error: buildError } = await db.rpc(
      "academia_can_build_subject",
      { _subject: subject },
    );
    if (buildError) throw new Error(buildError.message);
    return canBuild === true;
  },
  async ownsGame(gameId, userId) {
    const { data, error } = await db
      .from("slate_games")
      .select("owner_id, library")
      .eq("id", gameId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = data as { owner_id?: string; library?: boolean } | null;
    return row?.owner_id === userId || row?.library === true;
  },
  async attach(activity, gameId) {
    if (!activity.classId || !activity.subsectionId || !activity.notebookId)
      return false;
    try {
      return await attachOwnedGame(activity, gameId);
    } catch (error) {
      // A subject teacher may not own the hidden class. The save step's
      // database function can still write the link when they may edit.
      const message = error instanceof Error ? error.message : String(error);
      if (/42501|row-level security|permission denied|not_allowed|game_assign_failed/i.test(message)) {
        return true;
      }
      throw error;
    }
  },
  async saveGameId(activityId, gameId) {
    const linked = await setQuestionGame(activityId, gameId);
    if (linked === "ok") {
      await compileQuestionBoards(activityId, gameId);
      return true;
    }
    if (linked === "denied") return false;
    const patch = gameIdPatch(gameId);
    const { data, error } = await db
      .from("academia_activities")
      .update(patch)
      .eq("id", activityId)
      .select("id, game_id");
    if (error)
      throw new Error(
        error.message ||
          "The game could not be saved. This question is unchanged.",
      );
    const saved = (data ?? []) as { game_id?: string | null }[];
    const ok = saved.length > 0 && saved[0]?.game_id === gameId;
    if (ok) await compileQuestionBoards(activityId, gameId);
    return ok;
  },
  async othersStillUse(activity, gameId) {
    if (!activity.classId || !activity.subsectionId) return false;
    const { data, error } = await db
      .from("academia_activities")
      .select("id")
      .eq("class_id", activity.classId)
      .eq("subsection_id", activity.subsectionId)
      .eq("game_id", gameId)
      .neq("id", activity.id);
    if (error) throw new Error(error.message);
    return ((data ?? []) as { id: string }[]).length > 0;
  },
  async detach(activity, gameId) {
    if (!activity.classId || !activity.subsectionId) return;
    const { error } = await db
      .from("slate_game_questions")
      .delete()
      .eq("game_id", gameId)
      .eq("class_id", activity.classId)
      .eq("subsection_id", activity.subsectionId);
    if (error) throw new Error(error.message);
  },
};

export async function loadQuestionGameAccess(
  activityId: string,
): Promise<{ activity: QuestionGameActivity; canEdit: boolean } | null> {
  const activity = await loadRow(activityId);
  if (!activity) return null;
  const userId = await liveStore.userId();
  if (!userId) return { activity, canEdit: false };
  const canEdit = await liveStore.canManage(activity, userId);
  return { activity, canEdit };
}

export function linkActivityGame(activityId: string, gameId: string) {
  return linkQuestionGame(activityId, gameId, liveStore);
}
