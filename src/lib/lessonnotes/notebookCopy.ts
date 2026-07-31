// Notebook duplication.
//
// Lesson Notes is the *working area*; a Class is *permanent storage*. Assigning a
// notebook to a class never links the same object — it deep-copies the notebook
// (document, sections, subsections, blocks) so the two versions live independent
// lives. Deleting the working copy can therefore never touch the class copy.
import { supabase } from "@/integrations/supabase/client";

export type StorageScope = "workspace" | "class";

const NOTEBOOK_COPY_FIELDS = [
  "teacher",
  "class_name",
  "session",
  "subject",
  "title",
  "subtopic",
  "color_index",
  "document_json",
  "paper_size",
  "paper_style",
  "purpose",
  "score_label",
  "zoom",
  "cover_config",
] as const;

export interface DuplicateOptions {
  /** Where the new copy lives. */
  scope: StorageScope;
  /** Suffix appended to the title (e.g. " (copy)"). */
  titleSuffix?: string;
  /** class_lesson_notes.id this copy is checked out for editing. */
  checkoutLinkId?: string | null;
}

/**
 * Deep-copies a notebook and everything inside it. Returns the new notebook id.
 */
export const duplicateNotebook = async (
  notebookId: string,
  opts: DuplicateOptions,
): Promise<string> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");

  const { data: src, error: srcErr } = await supabase
    .from("notebooks")
    .select("*")
    .eq("id", notebookId)
    .single();
  if (srcErr || !src) throw srcErr ?? new Error("Notebook not found");

  const row: Record<string, unknown> = { owner_id: uid };
  for (const f of NOTEBOOK_COPY_FIELDS) row[f] = (src as Record<string, unknown>)[f] ?? null;
  if (row.color_index == null) row.color_index = 0;
  if (opts.titleSuffix && typeof row.title === "string" && row.title) {
    row.title = `${row.title}${opts.titleSuffix}`;
  }
  row.storage_scope = opts.scope;
  row.origin_notebook_id = notebookId;
  row.checkout_link_id = opts.checkoutLinkId ?? null;

  const { data: created, error: insErr } = await supabase
    .from("notebooks")
    .insert(row as never)
    .select("id")
    .single();
  if (insErr || !created) throw insErr ?? new Error("Duplicate failed");
  const newId = created.id as string;

  // Sections
  const { data: sections } = await supabase
    .from("notebook_sections")
    .select("*")
    .eq("notebook_id", notebookId)
    .order("order_index");

  const sectionMap = new Map<string, string>();
  for (const s of sections ?? []) {
    const { data: ns } = await supabase
      .from("notebook_sections")
      .insert({
        notebook_id: newId,
        kind: s.kind,
        order_index: s.order_index,
        stable_key: s.stable_key,
        title: s.title,
      } as never)
      .select("id")
      .single();
    if (ns) sectionMap.set(s.id, ns.id as string);
  }

  const oldSectionIds = Array.from(sectionMap.keys());
  if (oldSectionIds.length === 0) return newId;

  // Subsections
  const { data: subs } = await supabase
    .from("notebook_subsections")
    .select("*")
    .in("section_id", oldSectionIds)
    .order("order_index");

  const subMap = new Map<string, string>();
  for (const sub of subs ?? []) {
    const target = sectionMap.get(sub.section_id);
    if (!target) continue;
    const { data: nsub } = await supabase
      .from("notebook_subsections")
      .insert({
        section_id: target,
        order_index: sub.order_index,
        stable_key: sub.stable_key,
        floating_lines: sub.floating_lines,
        floating_bucket: sub.floating_bucket,
        floating_highlights: sub.floating_highlights,
        floating_scoring: sub.floating_scoring,
      } as never)
      .select("id")
      .single();
    if (nsub) subMap.set(sub.id, nsub.id as string);
  }

  // Blocks
  const { data: blocks } = await supabase
    .from("notebook_blocks")
    .select("*")
    .in("section_id", oldSectionIds)
    .order("order_index");

  const blockRows = (blocks ?? [])
    .map((b) => {
      const section_id = sectionMap.get(b.section_id);
      if (!section_id) return null;
      return {
        section_id,
        subsection_id: b.subsection_id ? subMap.get(b.subsection_id) ?? null : null,
        kind: b.kind,
        content_ascii: b.content_ascii,
        content_json: b.content_json,
        order_index: b.order_index,
      };
    })
    .filter(Boolean);
  if (blockRows.length) {
    await supabase.from("notebook_blocks").insert(blockRows as never);
  }

  return newId;
};

/**
 * "Assign to Class": copy the working notebook into class storage and return the
 * id of the stored duplicate.
 */
export const copyIntoClassStorage = (notebookId: string) =>
  duplicateNotebook(notebookId, { scope: "class" });

/**
 * "Edit" a note stored in a class: bring a working copy back into the Lesson
 * Notes workspace, remembering which class entry it must replace on Save.
 */
export const checkoutForEditing = (notebookId: string, linkId: string) =>
  duplicateNotebook(notebookId, { scope: "workspace", checkoutLinkId: linkId });

/**
 * "Save" a checked-out working copy back into the class: store a fresh duplicate,
 * repoint the class entry at it and remove the superseded stored copy.
 */
export const saveBackToClass = async (workingNotebookId: string, linkId: string) => {
  const { data: link, error } = await supabase
    .from("class_lesson_notes")
    .select("id, notebook_id")
    .eq("id", linkId)
    .single();
  if (error || !link) throw error ?? new Error("This class entry no longer exists");

  const storedId = await duplicateNotebook(workingNotebookId, { scope: "class" });
  const { error: upErr } = await supabase
    .from("class_lesson_notes")
    .update({ notebook_id: storedId })
    .eq("id", linkId);
  if (upErr) throw upErr;

  if (link.notebook_id && link.notebook_id !== storedId) {
    await supabase.from("notebooks").delete().eq("id", link.notebook_id);
  }
  return storedId;
};
