// Adventure assignments: whole lesson notes assigned to a class as "Adventures".
//
// Assign is a soft toggle — unassigning sets `unassigned_at` so any student
// progress that was already recorded against linked assessments survives, and
// re-assigning the same note simply clears the flag.

import { supabase } from "@/integrations/supabase/client";

export interface ClassAdventureNoteRow {
  id: string;
  class_id: string;
  notebook_id: string;
  section_id: string | null;
  question_key: string | null;
  assigned_by: string;
  due_at: string | null;
  created_at: string;
  unassigned_at?: string | null;
  notebook?: {
    id: string;
    title: string | null;
    subtopic: string | null;
    subject: string | null;
    score_label?: string | null;
  } | null;
  section?: {
    id: string;
    kind: string | null;
    title: string | null;
    order_index: number | null;
  } | null;
}

/** Assign (or re-assign) a lesson note to a class as an Adventure. */
export async function assignAdventureNote(params: {
  classId: string;
  notebookId: string;
  sectionId?: string | null;
  dueAt?: string | null;
}): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_authenticated");

  const sectionId = params.sectionId ?? null;
  let query = supabase
    .from("class_adventure_notes")
    .select("id, unassigned_at, created_at")
    .eq("class_id", params.classId)
    .eq("notebook_id", params.notebookId);
  query = sectionId === null ? query.is("section_id", null) : query.eq("section_id", sectionId);
  const { data: existingRows } = await query
    .order("created_at", { ascending: false })
    .limit(20);

  const rows = ((existingRows ?? []) as { id: string; unassigned_at: string | null }[]);
  const active = rows.find((row) => row.unassigned_at === null);
  if (active?.id) return active.id;

  const reusable = rows[0];
  if (reusable?.id) {
    await supabase
      .from("class_adventure_notes")
      .update({
        unassigned_at: null,
        due_at: params.dueAt ?? null,
        assigned_by: uid,
      } as never)
      .eq("id", reusable.id);
    return reusable.id;
  }

  const { data: created, error } = await supabase
    .from("class_adventure_notes")
    .insert({
      class_id: params.classId,
      notebook_id: params.notebookId,
      section_id: sectionId,
      due_at: params.dueAt ?? null,
      assigned_by: uid,
    } as never)
    .select("id")
    .single();
  if (error || !created?.id) throw new Error(error?.message ?? "adventure_assign_failed");
  return created.id as string;
}

/** List active adventure notes for a class. */
export async function listAdventureNotes(classId: string): Promise<ClassAdventureNoteRow[]> {
  const { data } = await supabase
    .from("class_adventure_notes")
    .select(
      "id, class_id, notebook_id, section_id, question_key, assigned_by, due_at, created_at, unassigned_at, notebook:notebook_id(id, title, subtopic, subject, score_label)",
    )
    .eq("class_id", classId)
    .is("unassigned_at", null)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as ClassAdventureNoteRow[];
  const sectionIds = Array.from(new Set(rows.map((r) => r.section_id).filter(Boolean))) as string[];
  if (sectionIds.length === 0) return rows;

  const { data: sections } = await supabase
    .from("notebook_sections")
    .select("id, kind, title, order_index")
    .in("id", sectionIds);
  const sectionById = new Map((sections ?? []).map((s: any) => [s.id as string, {
    id: s.id as string,
    kind: (s.kind ?? null) as string | null,
    title: (s.title ?? null) as string | null,
    order_index: typeof s.order_index === "number" ? s.order_index : null,
  }]));

  return rows.map((row) => ({
    ...row,
    section: row.section_id ? sectionById.get(row.section_id) ?? null : null,
  }));
}

export async function unassignAdventureNote(id: string): Promise<void> {
  await supabase
    .from("class_adventure_notes")
    .update({ unassigned_at: new Date().toISOString() } as never)
    .eq("id", id);
}

export async function findActiveAdventureNote(
  classId: string,
  notebookId: string,
  sectionId?: string | null,
): Promise<{ id: string } | null> {
  let query = supabase
    .from("class_adventure_notes")
    .select("id")
    .eq("class_id", classId)
    .eq("notebook_id", notebookId)
    .is("unassigned_at", null);
  if (sectionId !== undefined) {
    query = sectionId === null ? query.is("section_id", null) : query.eq("section_id", sectionId);
  }
  const { data } = await query.limit(1);
  return ((data ?? [])[0] as any) ?? null;
}
