// CRUD for saved games.
import { supabase } from "@/integrations/supabase/client";
import { GameCanvas, GameRow, makeScene } from "./types";
import { activeSchoolOrgId } from "@/lib/accounts/workspaceScope";


const emptyCanvas = (): GameCanvas => {
  const scene = makeScene(0);
  return { scenes: [scene], activeSceneId: scene.id };
};

export const createGame = async (title = "Untitled Game"): Promise<GameRow> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("games")
    .insert({ owner_id: uid, title, canvas: emptyCanvas() as never } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as GameRow;
};

export const getGame = async (id: string): Promise<GameRow> => {
  const { data, error } = await supabase.from("games").select("*").eq("id", id).single();
  if (error) throw error;
  return data as unknown as GameRow;
};

export const listGames = async (): Promise<GameRow[]> => {
  // Adventures live in the workspace they were built in.
  const orgId = await activeSchoolOrgId();
  let query = supabase.from("games").select("*");
  query = orgId ? query.eq("org_id", orgId) : query.is("org_id", null);
  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as GameRow[];
};


export const saveGameCanvas = async (id: string, canvas: GameCanvas): Promise<void> => {
  const { error } = await supabase
    .from("games")
    .update({ canvas: canvas as never })
    .eq("id", id);
  if (error) throw error;
};

export const renameGame = async (id: string, title: string): Promise<void> => {
  const { error } = await supabase.from("games").update({ title }).eq("id", id);
  if (error) throw error;
};

export const updateGameMeta = async (
  id: string,
  patch: { title?: string; topic?: string; subtopic?: string },
): Promise<void> => {
  const { error } = await supabase.from("games").update(patch as never).eq("id", id);
  if (error) throw error;
};

export const deleteGame = async (id: string): Promise<void> => {
  const { error } = await supabase.from("games").delete().eq("id", id);
  if (error) throw error;
};

export const generateGameCover = async (
  id: string,
  title: string,
): Promise<string | null> => {
  const { data, error } = await supabase.functions.invoke("generate-game-cover", {
    body: { gameId: id, title },
  });
  if (error) {
    console.error("generate-game-cover failed", error);
    return null;
  }
  return (data as { thumbnail_path?: string })?.thumbnail_path ?? null;
};
