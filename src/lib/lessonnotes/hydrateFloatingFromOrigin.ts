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
              normalizeProblemText(s.problem ?? "") === normalizeProblemText(target.problem ?? ""),
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
  const { data: sections, error: secErr } = await supabase
    .from("notebook_sections")
    .select("id")
    .eq("notebook_id", notebookId);
  if (secErr) throw new Error(secErr.message);
  const sectionIds = (sections ?? []).map((s) => s.id as string);
  if (sectionIds.length === 0) return [];

  const { data: subs, error: subErr } = await supabase
    .from("notebook_subsections")
    .select("id, doc_key, stable_key, floating_lines, floating_bucket, floating_highlights, floating_scoring")
    .in("section_id", sectionIds);
  if (subErr) throw new Error(subErr.message);
  const rows = (subs ?? []) as FloatingCarrier[];
  if (rows.length === 0) return [];

  const { data: blocks, error: blkErr } = await supabase
    .from("notebook_blocks")
    .select("subsection_id, kind, content_ascii")
    .in("subsection_id", rows.map((r) => r.id));
  if (blkErr) throw new Error(blkErr.message);
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
/** Short-lived memo of HEALTHY checks only, per signed-in user + notebook.
 *  The board waits for this check before it mounts; re-running the whole
 *  origin comparison on every quick reopen (or Next to another note and back)
 *  made opening slow. Staleness window: a check that completed cleanly is
 *  reused for at most HYDRATION_TTL_MS, so floating numbers prepared on the
 *  origin during the session are picked up on the next open after that, with
 *  no reload. Errors (Supabase `error` results or throws) and failed writes
 *  are never cached and retry on the next open. Concurrent opens share one
 *  in-flight run. */
export const HYDRATION_TTL_MS = 15_000;
const healthy = new Map<string, number>();
const inFlight = new Map<string, Promise<number>>();

/** Forget cached checks (e.g. after preparing floating numbers). */
export const invalidateFloatingHydration = (notebookId?: string) => {
  if (!notebookId) { healthy.clear(); return; }
  for (const key of [...healthy.keys()]) if (key.endsWith(`:${notebookId}`)) healthy.delete(key);
};
/** Test hook. */
export const resetFloatingHydrationMemo = () => { healthy.clear(); inFlight.clear(); };

const currentUserId = async (): Promise<string> => {
  try {
    const { data } = await (supabase.auth?.getSession?.() ?? Promise.resolve({ data: { session: null } }));
    return data?.session?.user?.id ?? "anon";
  } catch { return "anon"; }
};

type Outcome = { count: number; ok: boolean };

export const hydrateFloatingFromOrigin = async (notebookId: string): Promise<number> => {
  const key = `${await currentUserId()}:${notebookId}`;
  const at = healthy.get(key);
  if (at !== undefined && Date.now() - at < HYDRATION_TTL_MS) return 0;
  const running = inFlight.get(key);
  if (running) return running;
  const run = hydrateOnce(notebookId)
    .then((o) => {
      if (o.ok) healthy.set(key, Date.now()); else healthy.delete(key);
      return o.count;
    }, (error) => { healthy.delete(key); throw error; })
    .finally(() => { inFlight.delete(key); });
  inFlight.set(key, run);
  return run;
};

const hydrateOnce = async (notebookId: string): Promise<Outcome> => {
  const { data: nb, error: nbErr } = await supabase
    .from("notebooks")
    .select("id, origin_notebook_id")
    .eq("id", notebookId)
    .maybeSingle();
  if (nbErr) throw new Error(nbErr.message);
  const originId = (nb as { origin_notebook_id?: string | null } | null)?.origin_notebook_id;
  if (!originId) return { count: 0, ok: true };

  const targets = await loadCarriers(notebookId);
  if (targets.length === 0 || targets.every(hasPreparedFloating)) return { count: 0, ok: true };

  const sources = await loadCarriers(originId);
  const patches = planFloatingHydration(targets, sources);
  if (patches.length === 0) return { count: 0, ok: true };

  const results = await Promise.all(patches.map((patch) =>
    supabase
      .from("notebook_subsections")
      .update({
        floating_lines: patch.floating_lines as never,
        floating_bucket: patch.floating_bucket as never,
        floating_highlights: patch.floating_highlights as never,
        floating_scoring: patch.floating_scoring as never,
      })
      .eq("id", patch.id)));
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    // A read-only viewer cannot write; the board still opens with whatever
    // the copy already holds. Not cached: retried on the next open.
    console.warn("[floating hydrate] could not write prepared rows", failed.error.message);
    return { count: 0, ok: false };
  }
  return { count: patches.length, ok: true };
};
