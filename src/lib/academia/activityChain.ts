/**
 * Academia activity order: one activity = one question. Play leads to the
 * next activity's Play; Practice can step Prev/Next through the Session.
 */
import { supabase } from "@/integrations/supabase/client";
import { enterActivity, startAttempt, type AcademiaActivity } from "@/lib/academia/api";
import { inActivityChain, pickNeighbours } from "@/lib/academia/activityOrder";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type ActivityMode = "practice" | "play";

/** The previous/next activity in this Session that offers the given mode. */
export async function activityNeighbours(activityId: string, mode: ActivityMode) {
  const { data: current, error: currentError } = await db.from("academia_activities").select("id, session_id").eq("id", activityId).maybeSingle();
  if (currentError || !current) throw new Error("Session could not be loaded. Please try again.");
  const { data, error } = await db.from("academia_activities").select("*").eq("session_id", current.session_id).order("position").order("created_at");
  if (error) throw new Error("Session could not be loaded. Please try again.");
  const rows = (data ?? []) as AcademiaActivity[];
  const neighbours = pickNeighbours(rows, activityId, mode);
  if (neighbours.index < 0) throw new Error("This activity is not ready to play.");
  return { ...neighbours, sessionId: current.session_id as string };
}

/** The address that opens one activity directly in the given mode. */
export async function activityHref(activity: AcademiaActivity, mode: ActivityMode): Promise<string | null> {
  if (!inActivityChain(activity, mode)) return null;
  if (activity.kind === "mcq") {
    void startAttempt(activity.session_id, "practice", activity.id);
    return `/academia/mcq/${activity.id}`;
  }
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
