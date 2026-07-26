// Per-class reward placements inside a class Gallery. Each row records where a
// specific reward (identified by its element id inside a game's canvas) starts
// and ends when its animation plays in the class Gallery, plus its transform.
// The reward is NOT stored inside the gallery canvas JSON so the same reward
// can live in different places for different classes without touching gallery
// content.
import { supabase } from "@/integrations/supabase/client";
import type { MediaType, MediaSource } from "./types";

export interface ClassGalleryRewardRow {
  id: string;
  class_id: string;
  game_id: string;
  reward_element_id: string;
  asset_id: string | null;
  storage_path: string;
  media_type: MediaType;
  source: MediaSource;
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
  scale: number;
  rotation: number;
  opacity: number;
  duration_ms: number;
}

export const loadClassGalleryReward = async (
  classId: string,
  gameId: string,
  rewardElementId: string,
): Promise<ClassGalleryRewardRow | null> => {
  const { data, error } = await supabase
    .from("class_gallery_rewards" as never)
    .select("*")
    .eq("class_id", classId)
    .eq("game_id", gameId)
    .eq("reward_element_id", rewardElementId)
    .maybeSingle();
  if (error) throw error;
  return (data as ClassGalleryRewardRow | null) ?? null;
};

export const loadClassGalleryRewards = async (
  classId: string,
): Promise<ClassGalleryRewardRow[]> => {
  const { data, error } = await supabase
    .from("class_gallery_rewards" as never)
    .select("*")
    .eq("class_id", classId);
  if (error) throw error;
  return (data as ClassGalleryRewardRow[] | null) ?? [];
};

export interface UpsertClassGalleryRewardInput {
  class_id: string;
  game_id: string;
  reward_element_id: string;
  asset_id?: string | null;
  storage_path: string;
  media_type: MediaType;
  source: MediaSource;
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
  scale: number;
  rotation: number;
  opacity: number;
  duration_ms: number;
}

export const upsertClassGalleryReward = async (
  input: UpsertClassGalleryRewardInput,
): Promise<void> => {
  const { error } = await supabase
    .from("class_gallery_rewards" as never)
    .upsert(input as never, { onConflict: "class_id,game_id,reward_element_id" });
  if (error) throw error;
};
