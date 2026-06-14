import { supabase } from "@/integrations/supabase/client";
import type {
  AdventureGame,
  AdventureScene,
  AdventureSceneQuestion,
  BackgroundRef,
  SceneKind,
  SceneLayout,
} from "./types";

export async function listGames(): Promise<AdventureGame[]> {
  const { data, error } = await supabase
    .from("adventure_games")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AdventureGame[];
}

export async function createGame(input: {
  name: string;
  topic?: string;
  subtopic?: string;
  description?: string;
}): Promise<AdventureGame> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("adventure_games")
    .insert({
      owner_id: user.id,
      name: input.name,
      topic: input.topic ?? null,
      subtopic: input.subtopic ?? null,
      description: input.description ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as AdventureGame;
}

export async function deleteGame(id: string) {
  const { error } = await supabase.from("adventure_games").delete().eq("id", id);
  if (error) throw error;
}

export async function getGame(id: string): Promise<AdventureGame> {
  const { data, error } = await supabase.from("adventure_games").select("*").eq("id", id).single();
  if (error) throw error;
  return data as AdventureGame;
}

export async function listScenes(gameId: string): Promise<AdventureScene[]> {
  const { data, error } = await supabase
    .from("adventure_scenes")
    .select("*")
    .eq("game_id", gameId)
    .order("order_index", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((s) => ({
    ...s,
    background_ref: (s.background_ref ?? null) as unknown as BackgroundRef | null,
    layout_json: (s.layout_json ?? { items: [] }) as unknown as SceneLayout,
    config: (s.config ?? {}) as Record<string, unknown>,
  })) as AdventureScene[];
}

export async function sceneCount(gameId: string): Promise<number> {
  const { count, error } = await supabase
    .from("adventure_scenes")
    .select("id", { count: "exact", head: true })
    .eq("game_id", gameId);
  if (error) throw error;
  return count ?? 0;
}

export async function createScene(input: {
  game_id: string;
  kind: SceneKind;
  order_index: number;
  background_ref: BackgroundRef | null;
}): Promise<AdventureScene> {
  const { data, error } = await supabase
    .from("adventure_scenes")
    .insert({
      game_id: input.game_id,
      kind: input.kind,
      order_index: input.order_index,
      background_ref: input.background_ref as never,
      layout_json: { items: [] } as never,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as AdventureScene;
}

export async function updateScene(
  id: string,
  patch: Partial<Pick<AdventureScene, "title" | "background_ref" | "layout_json" | "required_progress" | "order_index" | "kind" | "config">>,
) {
  const { error } = await supabase
    .from("adventure_scenes")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteScene(id: string) {
  const { error } = await supabase.from("adventure_scenes").delete().eq("id", id);
  if (error) throw error;
}

export async function listSceneQuestions(sceneId: string): Promise<AdventureSceneQuestion[]> {
  const { data, error } = await supabase
    .from("adventure_scene_questions")
    .select("*")
    .eq("scene_id", sceneId)
    .order("order_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as AdventureSceneQuestion[];
}

export async function addSceneQuestion(input: {
  scene_id: string;
  vault_id?: string | null;
  prompt: string;
  answer?: string;
  marks: number;
  claim_once: boolean;
  order_index: number;
}) {
  const { error } = await supabase.from("adventure_scene_questions").insert({
    scene_id: input.scene_id,
    vault_id: input.vault_id ?? null,
    order_index: input.order_index,
    marks: input.marks,
    claim_once: input.claim_once,
    question_payload: { prompt: input.prompt, answer: input.answer ?? "" } as never,
  });
  if (error) throw error;
}

export async function deleteSceneQuestion(id: string) {
  const { error } = await supabase.from("adventure_scene_questions").delete().eq("id", id);
  if (error) throw error;
}
