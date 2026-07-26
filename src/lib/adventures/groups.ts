// Group Bars — a Progress Bar that has been assigned to one named group of
// students within a class+game. Every student belongs to at most one group;
// students not in any group are treated as "Whole Class".

import { supabase } from "@/integrations/supabase/client";

export type AdventureGroup = {
  id: string;
  class_id: string;
  game_id: string;
  name: string;
  progress_element_id: string;
};

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
    .select("id, class_id, game_id, name, progress_element_id")
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
): Promise<AdventureGroup> {
  const { data, error } = await supabase
    .from("adventure_groups" as never)
    .insert({ class_id: classId, game_id: gameId, name, progress_element_id: progressElementId } as never)
    .select("id, class_id, game_id, name, progress_element_id")
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
