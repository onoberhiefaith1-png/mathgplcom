// Assign games to classes (teacher) + list them (teacher & student).
import { supabase } from "@/integrations/supabase/client";
import { getGame } from "./games";
import { ensureClassGameBoards } from "./gameQuestions";
import type { GameRow } from "./types";

export interface ClassGameRow {
  id: string;
  title: string;
  thumbnail_path: string | null;
}

export async function listClassGames(classId: string): Promise<ClassGameRow[]> {
  const { data } = await supabase
    .from("class_games")
    .select("game_id, created_at, games:game_id(id, title, thumbnail_path)")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as any[])
    .map((r) => r.games)
    .filter(Boolean)
    .map((g: any) => ({ id: g.id, title: g.title, thumbnail_path: g.thumbnail_path }));
}

export async function assignedGameIds(classId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("class_games")
    .select("game_id")
    .eq("class_id", classId);
  return new Set((data ?? []).map((r: any) => r.game_id as string));
}

export async function assignGameToClass(gameId: string, classId: string): Promise<void> {
  await supabase
    .from("class_games")
    .upsert({ class_id: classId, game_id: gameId } as never, {
      onConflict: "class_id,game_id",
      ignoreDuplicates: true,
    });
  const game: GameRow = await getGame(gameId);
  await ensureClassGameBoards(game, classId);
}

export async function unassignGameFromClass(gameId: string, classId: string): Promise<void> {
  await supabase.from("class_games").delete().eq("class_id", classId).eq("game_id", gameId);
  await supabase.from("class_game_boards").delete().eq("class_id", classId).eq("game_id", gameId);
}
