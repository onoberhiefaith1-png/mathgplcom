import { supabase } from "@/integrations/supabase/client";

/** Optional organisation levels that can sit above Lesson Notes in a class. */
export type HierarchyLevel = "curriculum" | "syllabus" | "scheme";

export const LEVEL_ORDER: HierarchyLevel[] = ["curriculum", "syllabus", "scheme"];

export const LEVEL_LABEL: Record<HierarchyLevel, string> = {
  curriculum: "Curriculum",
  syllabus: "Syllabus",
  scheme: "Scheme of Work",
};

export type ContentNode = {
  id: string;
  class_id: string;
  parent_id: string | null;
  level: HierarchyLevel;
  name: string;
  description: string | null;
  order_index: number;
};

/**
 * Dependency rules: enabling a level automatically enables every level below
 * it (Curriculum -> Syllabus -> Scheme of Work). Disabling a level disables
 * everything above it. Returns the normalised, ordered level list.
 */
export const normalizeLevels = (levels: string[]): HierarchyLevel[] => {
  const set = new Set(levels.filter((l): l is HierarchyLevel => LEVEL_ORDER.includes(l as HierarchyLevel)));
  if (set.has("curriculum")) {
    set.add("syllabus");
    set.add("scheme");
  } else if (set.has("syllabus")) {
    set.add("scheme");
  }
  return LEVEL_ORDER.filter((l) => set.has(l));
};

/** Apply a single toggle with the dependency + cascade rules. */
export const toggleLevel = (levels: HierarchyLevel[], level: HierarchyLevel, on: boolean): HierarchyLevel[] => {
  if (on) return normalizeLevels([...levels, level]);
  const idx = LEVEL_ORDER.indexOf(level);
  // Turning a level off also turns off everything that depends on it.
  return normalizeLevels(levels.filter((l) => LEVEL_ORDER.indexOf(l) > idx));
};

export const getClassLevels = async (classId: string): Promise<HierarchyLevel[]> => {
  const { data } = await supabase.from("classes").select("lesson_note_levels").eq("id", classId).maybeSingle();
  return normalizeLevels(((data as { lesson_note_levels?: string[] } | null)?.lesson_note_levels ?? []) as string[]);
};

export const setClassLevels = async (classId: string, levels: HierarchyLevel[]) => {
  const { error } = await supabase
    .from("classes")
    .update({ lesson_note_levels: normalizeLevels(levels) } as never)
    .eq("id", classId);
  if (error) throw error;
};

export const listNodes = async (classId: string): Promise<ContentNode[]> => {
  const { data } = await supabase
    .from("class_content_nodes")
    .select("id, class_id, parent_id, level, name, description, order_index")
    .eq("class_id", classId)
    .order("order_index", { ascending: true })
    .order("name", { ascending: true });
  return ((data ?? []) as ContentNode[]);
};

export const createNode = async (input: {
  classId: string;
  parentId: string | null;
  level: HierarchyLevel;
  name: string;
  description?: string;
}) => {
  const { data, error } = await supabase
    .from("class_content_nodes")
    .insert({
      class_id: input.classId,
      parent_id: input.parentId,
      level: input.level,
      name: input.name,
      description: input.description ?? null,
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  return data as { id: string };
};

export const renameNode = async (id: string, name: string) => {
  const { error } = await supabase.from("class_content_nodes").update({ name } as never).eq("id", id);
  if (error) throw error;
};

export const deleteNode = async (id: string) => {
  const { error } = await supabase.from("class_content_nodes").delete().eq("id", id);
  if (error) throw error;
};

export const setNoteNode = async (linkId: string, nodeId: string | null) => {
  const { error } = await supabase.from("class_lesson_notes").update({ node_id: nodeId } as never).eq("id", linkId);
  if (error) throw error;
};
