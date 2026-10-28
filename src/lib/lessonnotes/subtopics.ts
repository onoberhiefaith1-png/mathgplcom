import { supabase } from "@/integrations/supabase/client";

/** A subtopic inside a Topic notebook. The ACTIVE subtopic's pages live in
 *  `notebooks.document_json` (so every existing reader keeps working); the
 *  others keep their pages on their own row until switched to. */
export type Subtopic = { id: string; notebook_id: string; name: string; order_index: number; document_json: unknown | null };

export const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

/** Pure: next order index for a new subtopic. */
export const nextOrderIndex = (list: Pick<Subtopic, "order_index">[]) =>
  list.reduce((m, s) => Math.max(m, s.order_index), -1) + 1;

/** Pure: move one subtopic up/down; returns the reordered list with fresh indexes. */
export const moveSubtopic = <T extends { id: string; order_index: number }>(list: T[], id: string, dir: -1 | 1): T[] => {
  const sorted = [...list].sort((a, b) => a.order_index - b.order_index);
  const i = sorted.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sorted.length) return sorted;
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  return sorted.map((s, k) => ({ ...s, order_index: k }));
};

/** Pure: which subtopic becomes active after deleting one. */
export const activeAfterDelete = (list: { id: string; order_index: number }[], deletedId: string, activeId: string | null) => {
  if (activeId !== deletedId) return activeId;
  const rest = [...list].sort((a, b) => a.order_index - b.order_index).filter((s) => s.id !== deletedId);
  return rest[0]?.id ?? null;
};

/** Pure: does a document have any real content? */
export const docHasContent = (doc: unknown): boolean => {
  const walk = (n: any): boolean => {
    if (!n || typeof n !== "object") return false;
    if (typeof n.text === "string" && n.text.trim()) return true;
    if (n.type && !["doc", "paragraph", "text", "hardBreak"].includes(n.type)) return true;
    return Array.isArray(n.content) && n.content.some(walk);
  };
  return walk(doc);
};

const db = supabase as any;

export const listSubtopics = async (notebookId: string): Promise<Subtopic[]> => {
  const { data, error } = await db.from("notebook_subtopics").select("id, notebook_id, name, order_index, document_json")
    .eq("notebook_id", notebookId).order("order_index");
  if (error) throw error;
  return (data ?? []) as Subtopic[];
};

export const listSubtopicCounts = async (notebookIds: string[]): Promise<Record<string, number>> => {
  if (!notebookIds.length) return {};
  const { data } = await db.from("notebook_subtopics").select("notebook_id").in("notebook_id", notebookIds);
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { notebook_id: string }[]) out[r.notebook_id] = (out[r.notebook_id] ?? 0) + 1;
  return out;
};

export const createSubtopic = async (notebookId: string, name: string, order_index: number) => {
  const { data, error } = await db.from("notebook_subtopics")
    .insert({ notebook_id: notebookId, name, order_index, document_json: EMPTY_DOC }).select("id, notebook_id, name, order_index, document_json").single();
  if (error) throw error;
  return data as Subtopic;
};

export const updateSubtopic = async (id: string, patch: Partial<Pick<Subtopic, "name" | "order_index" | "document_json">>) => {
  const { error } = await db.from("notebook_subtopics").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
};

export const deleteSubtopic = async (id: string) => {
  const { error } = await db.from("notebook_subtopics").delete().eq("id", id);
  if (error) throw error;
};

export const setActiveSubtopic = async (notebookId: string, subtopic: { id: string; name: string } | null) => {
  const { error } = await db.from("notebooks")
    .update({ active_subtopic_id: subtopic?.id ?? null, subtopic: subtopic?.name ?? "" }).eq("id", notebookId);
  if (error) throw error;
};
