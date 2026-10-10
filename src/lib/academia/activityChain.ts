/**
 * Academia activity order: one activity = one question. Play leads to the
 * next activity's Play; Practice can step Prev/Next through the Session.
 */
import { supabase } from "@/integrations/supabase/client";
import { enterActivity, startAttempt, type AcademiaActivity } from "@/lib/academia/api";
import { pickNeighbours } from "@/lib/academia/activityOrder";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type ActivityMode = "practice" | "play";

/** The previous/next activity in this Session that offers the given mode. */
export async function activityNeighbours(activityId: string, mode: ActivityMode) {
  const { data: current } = await db.from("academia_activities").select("id, session_id").eq("id", activityId).maybeSingle();
  if (!current) return { prev: null, next: null, sessionId: null as string | null, index: -1, total: 0 };
  const { data } = await db.from("academia_activities").select("*").eq("session_id", current.session_id).order("position").order("created_at");
  const rows = (data ?? []) as AcademiaActivity[];
  return { ...pickNeighbours(rows, activityId, mode), sessionId: current.session_id as string };
}

/** The address that opens one activity directly in the given mode. */
export async function activityHref(activity: AcademiaActivity, mode: ActivityMode): Promise<string | null> {
  const entry = await enterActivity(activity.id);
  if (!entry.ready || !entry.class_id) return null;
  void startAttempt(activity.session_id, mode, activity.id);
  if (mode === "practice") {
    if (!entry.assessment_id) return null;
    return `/academia/practice/${entry.class_id}/${entry.assessment_id}?${new URLSearchParams({ academia: activity.id })}`;
  }
  if (!entry.game_id) return null;
  return `/game/play/${entry.game_id}?${new URLSearchParams({ classId: entry.class_id, academia: activity.id })}`;
}
