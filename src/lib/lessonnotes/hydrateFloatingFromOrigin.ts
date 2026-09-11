// Prepared Floating Numbers live on each question row (`notebook_subsections`),
// not inside the document text. A stored class copy of a lesson note therefore
// carries the questions but can be missing the preparation that was saved on
// the original note.
//
// This module is the ONE place that brings the prepared rows across, so every
// gateway (Main Smartboard, Class SmartBoard) opens exactly the structure the
// Test board uses. It never invents floating content and never overwrites
// preparation that already exists on the copy.

import { supabase } from "@/integrations/supabase/client";

/** Same normalization the document sync uses, so matching agrees with it. */
export const normalizeProblemText = (s: string): string =>
  String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

export interface FloatingCarrier {
  id: string;
  doc_key?: string | null;
  stable_key?: string | null;
  /** Problem text of the question this row belongs to (may be absent). */
  problem?: string | null;
  floating_lines?: unknown;
  floating_bucket?: unknown;
  floating_highlights?: unknown;
  floating_scoring?: unknown;
}

const isEmptyArray = (v: unknown) => !Array.isArray(v) || v.length === 0;

/** A row is "unprepared" when it carries no saved floating structure at all. */
export const hasPreparedFloating = (row: FloatingCarrier): boolean =>
  !isEmptyArray(row.floating_lines) ||
  !isEmptyArray(row.floating_highlights) ||
  (row.floating_bucket != null && row.floating_bucket !== undefined);

export interface FloatingPatch {
  id: string;
  floating_lines: unknown;
  floating_bucket: unknown;
  floating_highlights: unknown;
  floating_scoring: unknown;
}

/**
 * Pure matcher: for every target row with no preparation, find its source row
 * by durable key first (`doc_key`, then `stable_key`), then by problem text.
 * Each source row is consumed once so two questions can never share one
 * question's prepared numbers.
 */
export const planFloatingHydration = (
  targets: FloatingCarrier[],
  sources: FloatingCarrier[],
): FloatingPatch[] => {
  const prepared = sources.filter(hasPreparedFloating);
  const used = new Set<string>();
  const patches: FloatingPatch[] = [];

  const take = (pred: (s: FloatingCarrier) => boolean) => {
    const hit = prepared.find((s) => !used.has(s.id) && pred(s));
    if (hit) used.add(hit.id);
    return hit;
  };

  for (const target of targets) {
    if (hasPreparedFloating(target)) continue;
    const source =
      (target.doc_key ? take((s) => !!s.doc_key && s.doc_key === target.doc_key) : undefined) ??
      (target.stable_key
        ? take((s) => !!s.stable_key && s.stable_key === target.stable_key)
        : undefined) ??
      (target.problem?.trim()
        ? take(
            (s) =>
              !!s.problem?.trim() &&
              normalizeProblemText(s.problem) === normalizeProblemText(target.problem),
          )
        : undefined);
    if (!source) continue;
    patches.push({
      id: target.id,
      floating_lines: source.floating_lines ?? [],
      floating_bucket: source.floating_bucket ?? null,
      floating_highlights: source.floating_highlights ?? null,
      floating_scoring: source.floating_scoring ?? null,
    });
  }
  return patches;
};

const loadCarriers = async (notebookId: string): Promise<FloatingCarrier[]> => {
  const { data: sections } = await supabase
    .from("notebook_sections")
    .select("id")
    .eq("notebook_id", notebookId);
  const sectionIds = (sections ?? []).map((s) => s.id as string);
  if (sectionIds.length === 0) return [];

  const { data: subs } = await supabase
    .from("notebook_subsections")
    .select("id, doc_key, stable_key, floating_lines, floating_bucket, floating_highlights, floating_scoring")
    .in("section_id", sectionIds);
  const rows = (subs ?? []) as FloatingCarrier[];
  if (rows.length === 0) return [];

  const { data: blocks } = await supabase
    .from("notebook_blocks")
    .select("subsection_id, kind, content_ascii")
    .in("subsection_id", rows.map((r) => r.id));
  const problemBySub = new Map<string, string>();
  for (const b of blocks ?? []) {
    const rec = b as { subsection_id?: string | null; kind?: string; content_ascii?: string | null };
    if (rec.kind === "problem" && rec.subsection_id) {
      problemBySub.set(rec.subsection_id, String(rec.content_ascii ?? ""));
    }
  }
  return rows.map((r) => ({ ...r, problem: problemBySub.get(r.id) ?? null }));
};

/**
 * Bring prepared Floating Numbers from a notebook's origin (the note it was
 * copied from) onto the copy, for questions that have none. Safe to call on
 * every open: it is a no-op when the notebook is an original, when the origin
 * has no preparation, or when the copy is already prepared.
 *
 * Returns the number of questions that were filled in.
 */
export const hydrateFloatingFromOrigin = async (notebookId: string): Promise<number> => {
  const { data: nb } = await supabase
    .from("notebooks")
    .select("id, origin_notebook_id")
    .eq("id", notebookId)
    .maybeSingle();
  const originId = (nb as { origin_notebook_id?: string | null } | null)?.origin_notebook_id;
  if (!originId) return 0;

  const targets = await loadCarriers(notebookId);
  if (targets.length === 0 || targets.every(hasPreparedFloating)) return 0;

  const sources = await loadCarriers(originId);
  const patches = planFloatingHydration(targets, sources);
  if (patches.length === 0) return 0;

  for (const patch of patches) {
    const { error } = await supabase
      .from("notebook_subsections")
      .update({
        floating_lines: patch.floating_lines as never,
        floating_bucket: patch.floating_bucket as never,
        floating_highlights: patch.floating_highlights as never,
        floating_scoring: patch.floating_scoring as never,
      })
      .eq("id", patch.id);
    if (error) {
      // A read-only viewer cannot write; the board still opens with whatever
      // the copy already holds.
      console.warn("[floating hydrate] could not write prepared rows", error.message);
      return 0;
    }
  }
  return patches.length;
};
