// Runtime record of rewards a group has actually EARNED inside a class.
// The placement (start/end/scale/rotation) still lives in `class_gallery_rewards`
// — that is the single shared layout every group's Gallery uses. This table only
// says "group X won reward Y from game Z", so each group's Gallery shows the
// same layout but different earned rewards.
import { supabase } from "@/integrations/supabase/client";

export interface ClassGalleryAwardRow {
  id: string;
  class_id: string;
  game_id: string;
  reward_element_id: string;
  /** null = whole class (no groups configured) */
  group_id: string | null;
  awarded_at: string;
}

export const loadClassGalleryAwards = async (
  classId: string,
): Promise<ClassGalleryAwardRow[]> => {
  const { data, error } = await supabase
    .from("class_gallery_awards" as never)
    .select("id, class_id, game_id, reward_element_id, group_id, awarded_at")
    .eq("class_id", classId);
  if (error) throw error;
  return (data as unknown as ClassGalleryAwardRow[] | null) ?? [];
};

/**
 * Record a reward as earned. Idempotent — the unique index means the first
 * client to insert wins and later duplicates are ignored.
 */
export const awardClassGalleryReward = async (input: {
  class_id: string;
  game_id: string;
  reward_element_id: string;
  group_id: string | null;
}): Promise<void> => {
  const { error } = await supabase
    .from("class_gallery_awards" as never)
    .insert(input as never);
  // 23505 = unique violation → already awarded, which is a success for us.
  if (error && (error as { code?: string }).code !== "23505") throw error;
};
