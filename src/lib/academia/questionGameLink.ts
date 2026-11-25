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

async function floatingLineCount(subsectionId: string | null): Promise<number> {
  if (!subsectionId) return 0;
  const { data, error } = await db
    .from("notebook_subsections")
    .select("floating_lines")
    .eq("id", subsectionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return linesForQuestion(data?.floating_lines, null).length;
}

function toActivity(row: ActivityRow, lines: number): QuestionGameActivity {
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
    return canManageAcademiaActivity({
      isOrgOwner: owner === true,
      userId,
      activityCreatedBy:
        (row as { created_by?: string | null } | null)?.created_by ?? null,
      sessionCreatedBy:
        (session as { created_by?: string | null } | null)?.created_by ?? null,
    });
  },
  async ownsGame(gameId, userId) {
    const { data, error } = await db
      .from("slate_games")
      .select("owner_id")
      .eq("id", gameId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as { owner_id?: string } | null)?.owner_id === userId;
  },
  async attach(activity, gameId) {
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
  },
  async saveGameId(activityId, gameId) {
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
    return saved.length > 0 && saved[0]?.game_id === gameId;
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
