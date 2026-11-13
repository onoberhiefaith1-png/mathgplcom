// Publish the building that should be on screen.
//
// Admins (platform owner, co-admin, and accounts linked to one) set the
// platform Pro or Free selection. A pro teacher or a pro school sets the
// building for the workspace they own. The database refuses everyone else.
import { supabase } from "@/integrations/supabase/client";
import type { HomepageConfig } from "./homepageConfig";

export async function loadBuildingAdmin(): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return false;
  const { data, error } = await supabase.rpc("is_building_admin", { _uid: uid });
  if (error) throw error;
  return data === true;
}

/**
 * Make `buildingId` the building people see.
 * A non-empty exterior is stored on that building first, so the face travels
 * with the selection instead of staying on this account's homepage.
 */
export async function publishBuildingChoice(input: {
  buildingId: string;
  orgId: string | null;
  exterior?: HomepageConfig | null;
  /** Required for an admin: which platform category this choice is. */
  platformTier?: "pro" | "free" | null;
}): Promise<void> {
  if (input.exterior && Object.keys(input.exterior).length > 0) {
    const { error } = await supabase
      .from("buildings")
      .update({ exterior_config: input.exterior as never })
      .eq("id", input.buildingId);
    if (error) throw error;
  }

  const admin = await loadBuildingAdmin();
  const { error } = await supabase.rpc("select_displayed_building", {
    _building_id: input.buildingId,
    _org_id: admin ? null : input.orgId,
    _tier: admin ? input.platformTier ?? "pro" : null,
  });
  if (error) throw error;
}
