// CLASS ─► ADVENTURE LINK.
//
// An Adventure is a reusable video experience. It never owns questions and is
// never duplicated to be used with different content. A class simply LINKS an
// adventure; questions arrive later, per class, per progress bar.
//
//   Adventure (shell)  ──linked──►  Class A, Class B, Class C
//
// Unlinking removes ONLY the (class, adventure) relationship.

import { supabase } from "@/integrations/supabase/client";
import { activeSchoolOrgId } from "@/lib/accounts/workspaceScope";
import type { GameRow } from "@/lib/games/types";

export interface LinkedAdventure {
  id: string;
  gameId: string;
  title: string;
  subtopic: string | null;
  thumbnailPath: string | null;
  createdAt: string;
}

/** Adventures linked to this class, newest first. */
export async function listClassAdventures(classId: string): Promise<LinkedAdventure[]> {
  const { data, error } = await supabase
    .from("class_adventures" as never)
    .select("id, game_id, created_at, games:game_id(id, title, subtopic, thumbnail_path)")
    .eq("class_id" as never, classId as never)
    .is("unlinked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw databaseError("list_class_adventures", error);
  const out: LinkedAdventure[] = [];
  for (const row of (data ?? []) as any[]) {
    const g = row.games;
    if (!g?.id) continue;
    out.push({
      id: row.id as string,
      gameId: g.id as string,
      title: (g.title as string) || "Adventure",
      subtopic: (g.subtopic as string) ?? null,
      thumbnailPath: (g.thumbnail_path as string) ?? null,
      createdAt: row.created_at as string,
    });
  }
  return out;
}

export interface StudentAdventure extends LinkedAdventure {
  /** Progress bars of this class adventure that actually carry questions. */
  barCount: number;
  questionCount: number;
}

/** What a student sees: the adventures linked to their class, playable only. */
export async function listStudentAdventures(classId: string): Promise<StudentAdventure[]> {
  const linked = await listClassAdventures(classId);
  if (linked.length === 0) return [];
  const { data } = await supabase
    .from("class_game_boards")
    .select("game_id, progress_element_id, question_keys")
    .eq("class_id", classId)
    .in(
      "game_id",
      linked.map((a) => a.gameId),
    );
  const stats = new Map<string, { bars: number; questions: number }>();
  for (const row of (data ?? []) as any[]) {
    const cur = stats.get(row.game_id as string) ?? { bars: 0, questions: 0 };
    cur.bars += 1;
    cur.questions += Array.isArray(row.question_keys) ? row.question_keys.length : 0;
    stats.set(row.game_id as string, cur);
  }
  return linked.map((a) => ({
    ...a,
    barCount: stats.get(a.gameId)?.bars ?? 0,
    questionCount: stats.get(a.gameId)?.questions ?? 0,
  }));
}

/** Adventures the teacher can link — own workspace only.
 *  Only the picker fields are read: the saved world (canvas) is megabytes and
 *  would make this list take minutes. */
export async function listLinkableAdventures(): Promise<GameRow[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  const orgId = await activeSchoolOrgId();
  let q = supabase
    .from("games")
    .select("id, title, topic, subtopic, thumbnail_path, updated_at, owner_id, org_id")
    .eq("owner_id", uid ?? "");
  q = orgId ? q.eq("org_id", orgId) : q.is("org_id", null);
  const { data, error } = await q.order("updated_at", { ascending: false }).limit(200);
  if (error) throw databaseError("list_linkable_adventures", error);
  return (data ?? []) as unknown as GameRow[];
}

export async function linkAdventure(classId: string, gameId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_authenticated");
  const { error } = await supabase
    .from("class_adventures" as never)
    .upsert(
      { class_id: classId, game_id: gameId, linked_by: uid, unlinked_at: null } as never,
      { onConflict: "class_id,game_id" },
    );
  if (error) throw databaseError("link_class_adventure", error);
}

/** Hide ONLY this class's use of the adventure. Its bar configuration and
 * student work remain stored, so linking it again restores the class exactly. */
export async function unlinkAdventure(classId: string, gameId: string): Promise<void> {
  const { error } = await supabase
    .from("class_adventures" as never)
    .update({ unlinked_at: new Date().toISOString() } as never)
    .eq("class_id" as never, classId as never)
    .eq("game_id" as never, gameId as never);
  if (error) throw databaseError("unlink_class_adventure", error);
}

type DatabaseFailure = { code?: string | null; message?: string | null; details?: string | null };

function databaseError(operation: string, failure: DatabaseFailure): Error {
  console.error("Adventure database operation failed", {
    operation,
    table: "class_adventures",
    code: failure.code ?? null,
    message: failure.message ?? null,
    details: failure.details ?? null,
  });
  const error = new Error("The Adventure relationship could not be saved. Please try again.");
  error.name = "AdventureDatabaseError";
  return error;
}
