// Game Mode of one class+game: Individual play, or Group Competition.
//
// The mode is chosen on the Adventure page (setup), never on the gameplay
// dashboard. The dashboard only reads it to decide whether to show the Group
// Competition Board.

import { supabase } from "@/integrations/supabase/client";

export type GameMode = "individual" | "group";

export const GAME_MODE_LABEL: Record<GameMode, string> = {
  individual: "Individual Mode",
  group: "Group Competition Mode",
};

export async function getGameMode(classId: string, gameId: string): Promise<GameMode> {
  const { data } = await supabase
    .from("class_games" as never)
    .select("game_mode")
    .eq("class_id", classId)
    .eq("game_id", gameId)
    .limit(1);
  const row = (data ?? [])[0] as { game_mode: string | null } | undefined;
  return row?.game_mode === "group" ? "group" : "individual";
}

export async function setGameMode(classId: string, gameId: string, mode: GameMode): Promise<void> {
  const { error } = await supabase
    .from("class_games" as never)
    .update({ game_mode: mode } as never)
    .eq("class_id", classId)
    .eq("game_id", gameId);
  if (error) throw error;
}
