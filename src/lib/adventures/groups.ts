// Group Bars — a Progress Bar that has been assigned to one named group of
// students within a class+game.
//
// Grouping starts by ADOPTING the lesson's existing Progress Bar as Group A
// (every student joins it). Later groups DUPLICATE that bar: the clone lives
// only as a row here (source element + position) and inherits every setting of
// the original at render time. Every student belongs to exactly one group.

import { supabase } from "@/integrations/supabase/client";

export type AdventureGroup = {
  id: string;
  class_id: string;
  game_id: string;
  name: string;
  /** For the primary group this is the original bar; for clones it is `grpbar-<id>`. */
  progress_element_id: string;
  /** Original bar this group's bar was copied from (null for the primary group). */
  source_element_id: string | null;
  is_primary: boolean;
  position_x: number | null;
  position_y: number | null;
  /** Look of a duplicated bar. Appearance only — never questions or scoring. */
  style_color: string | null;
  style_scale: number | null;
  style_preset_id: string | null;
  /** Video Adventure: false once the group missed a Learning Point target. */
  qualified: boolean;
  completed_at: string | null;
  eliminated_at_scene_id: string | null;
};

/** Groups per class+game are capped so the stage stays readable. */
export const MAX_GROUPS = 10;

export const DEFAULT_GROUP_COMPLETION_MESSAGE =
  "This part of the journey isn't over yet. Gather your team, review your strategy, and try again. Every great explorer succeeds through persistence!";

const GROUP_COLS =
  "id, class_id, game_id, name, progress_element_id, source_element_id, is_primary, position_x, position_y, style_color, style_scale, style_preset_id, qualified, completed_at, eliminated_at_scene_id";

export type AdventureGroupMember = {
  id: string;
  group_id: string;
  student_id: string;
  class_id: string;
  game_id: string;
};

export async function listGroups(classId: string, gameId: string): Promise<AdventureGroup[]> {
  const { data } = await supabase
    .from("adventure_groups" as never)
    .select(GROUP_COLS)
    .eq("class_id", classId)
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });
  return (data ?? []) as unknown as AdventureGroup[];
}

export async function listGroupMembers(classId: string, gameId: string): Promise<AdventureGroupMember[]> {
  const { data } = await supabase
    .from("adventure_group_members" as never)
    .select("id, group_id, student_id, class_id, game_id")
    .eq("class_id", classId)
    .eq("game_id", gameId);
  return (data ?? []) as unknown as AdventureGroupMember[];
}

export async function createGroup(
  classId: string,
  gameId: string,
  name: string,
  progressElementId: string,
  extra?: { sourceElementId?: string | null; isPrimary?: boolean; x?: number | null; y?: number | null },
): Promise<AdventureGroup> {
  const { data, error } = await supabase
    .from("adventure_groups" as never)
    .insert({
      class_id: classId,
      game_id: gameId,
      name,
      progress_element_id: progressElementId,
      source_element_id: extra?.sourceElementId ?? null,
      is_primary: extra?.isPrimary ?? false,
      position_x: extra?.x ?? null,
      position_y: extra?.y ?? null,
    } as never)
    .select(GROUP_COLS)
    .single();
  if (error) throw error;
  return data as unknown as AdventureGroup;
}

export async function renameGroup(id: string, name: string): Promise<void> {
  const { error } = await supabase.from("adventure_groups" as never).update({ name } as never).eq("id", id);
  if (error) throw error;
}

export async function deleteGroup(id: string): Promise<void> {
  const { error } = await supabase.from("adventure_groups" as never).delete().eq("id", id);
  if (error) throw error;
}

/** Move a duplicated bar. Position only — never any other setting. */
export async function moveGroupBar(id: string, x: number, y: number): Promise<void> {
  const { error } = await supabase
    .from("adventure_groups" as never)
    .update({ position_x: x, position_y: y } as never)
    .eq("id", id);
  if (error) throw error;
}

/** Point a clone group's bar at its own element id once the row id is known. */
export async function setGroupBarElement(id: string, elementId: string): Promise<void> {
  const { error } = await supabase
    .from("adventure_groups" as never)
    .update({ progress_element_id: elementId } as never)
    .eq("id", id);
  if (error) throw error;
}

/** Move a student to a group, or to "Whole Class" (groupId = null). */
export async function assignStudentToGroup(
  classId: string,
  gameId: string,
  studentId: string,
  groupId: string | null,
): Promise<void> {
  // Uniqueness on (class_id, game_id, student_id) means we always remove any
  // existing membership first, then insert the new one.
  const { error: delErr } = await supabase
    .from("adventure_group_members" as never)
    .delete()
    .eq("class_id", classId)
    .eq("game_id", gameId)
    .eq("student_id", studentId);
  if (delErr) throw delErr;

  if (groupId) {
    const { error } = await supabase
      .from("adventure_group_members" as never)
      .insert({ class_id: classId, game_id: gameId, student_id: studentId, group_id: groupId } as never);
    if (error) throw error;
  }
}

/** Put a list of students into one group in a single round of writes. */
export async function assignManyToGroup(
  classId: string,
  gameId: string,
  studentIds: string[],
  groupId: string,
): Promise<void> {
  if (studentIds.length === 0) return;
  const { error: delErr } = await supabase
    .from("adventure_group_members" as never)
    .delete()
    .eq("class_id", classId)
    .eq("game_id", gameId)
    .in("student_id", studentIds);
  if (delErr) throw delErr;
  const { error } = await supabase.from("adventure_group_members" as never).insert(
    studentIds.map((sid) => ({
      class_id: classId,
      game_id: gameId,
      student_id: sid,
      group_id: groupId,
    })) as never,
  );
  if (error) throw error;
}

/** All groups in a class across every game — used by the Gallery group tabs. */
export async function listClassGroups(classId: string): Promise<AdventureGroup[]> {
  const { data } = await supabase
    .from("adventure_groups" as never)
    .select(GROUP_COLS)
    .eq("class_id", classId)
    .order("created_at", { ascending: true });
  return (data ?? []) as unknown as AdventureGroup[];
}

/** Group ids this student belongs to within a class (across games). */
export async function listStudentGroupIds(classId: string, studentId: string): Promise<string[]> {
  const { data } = await supabase
    .from("adventure_group_members" as never)
    .select("group_id")
    .eq("class_id", classId)
    .eq("student_id", studentId);
  return ((data ?? []) as unknown as Array<{ group_id: string }>).map((r) => r.group_id);
}

/** Restyle a duplicated bar. Appearance only — questions and scoring never change. */
export async function styleGroupBar(
  id: string,
  style: { color?: string | null; scale?: number | null; presetId?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if ("color" in style) patch['style_color'] = style.color ?? null;
  if ("scale" in style) patch['style_scale'] = style.scale ?? null;
  if ("presetId" in style) patch['style_preset_id'] = style.presetId ?? null;
  const { error } = await supabase.from("adventure_groups" as never).update(patch as never).eq("id", id);
  if (error) throw error;
}

/** Video Adventure — record the outcome of a Learning Point for one group. */
export async function setGroupQualification(
  id: string,
  qualified: boolean,
  sceneId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("adventure_groups" as never)
    .update({
      qualified,
      eliminated_at_scene_id: qualified ? null : sceneId,
      completed_at: qualified ? new Date().toISOString() : null,
    } as never)
    .eq("id", id);
  if (error) throw error;
}

/** The teacher's encouraging message for groups that missed the target. */
export async function getGroupCompletionMessage(classId: string, gameId: string): Promise<string> {
  const { data } = await supabase
    .from("class_games" as never)
    .select("group_completion_message")
    .eq("class_id", classId)
    .eq("game_id", gameId)
    .limit(1);
  const row = (data ?? [])[0] as { group_completion_message: string | null } | undefined;
  return row?.group_completion_message?.trim() || DEFAULT_GROUP_COMPLETION_MESSAGE;
}

export async function setGroupCompletionMessage(
  classId: string,
  gameId: string,
  message: string,
): Promise<void> {
  const { error } = await supabase
    .from("class_games" as never)
    .update({ group_completion_message: message.trim() || null } as never)
    .eq("class_id", classId)
    .eq("game_id", gameId);
  if (error) throw error;
}

/** Adventure race — the first group to finish, if any. */
export async function recordRaceWinner(classId: string, gameId: string, groupId: string | null): Promise<void> {
  const { error } = await supabase
    .from("class_games" as never)
    .update({ winner_group_id: groupId } as never)
    .eq("class_id", classId)
    .eq("game_id", gameId);
  if (error) throw error;
}

/**
 * Restart Game — clear every judgement from the previous run so the replay
 * decides each Learning Point from live data. Student marks live in
 * `game_progress` and are never touched here.
 */
export async function resetGroupJudgements(classId: string, gameId: string): Promise<void> {
  await supabase
    .from("adventure_groups" as never)
    .update({ qualified: true, eliminated_at_scene_id: null, completed_at: null } as never)
    .eq("class_id", classId)
    .eq("game_id", gameId);
  await supabase
    .from("class_games" as never)
    .update({ winner_group_id: null } as never)
    .eq("class_id", classId)
    .eq("game_id", gameId);
}
