/**
 * THE BUILDING'S EXTERIOR — the rotating face that travels with a building.
 *
 * A building is one complete asset: the rotating exterior + the interior. The
 * interior lives in the building tables; the exterior is the homepage building
 * configuration (16 artwork positions, rotation speed, background, or a whole
 * replacement building). When a building is saved into the gallery both are
 * captured, and when somebody uses a gallery building both are restored.
 *
 * Restoring never destroys what was there: the current exterior is filed into
 * the Buildings shelf first, so an earlier version can always be brought back.
 */
import { supabase } from "@/integrations/supabase/client";
import type { HomepageConfig } from "@/lib/homepage/homepageConfig";
import { resolveMediaUrl } from "@/lib/homepage/homepageConfig";
import { snapshotBuilding } from "@/lib/homepage/buildingAssets";
import { RING_SLOTS } from "@/lib/homepage/buildingSlots";

/** The exterior of the signed-in account's own (Pro) homepage building. */
export const readMyExterior = async (): Promise<HomepageConfig> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return {};
  const { data } = await supabase
    .from("profiles")
    .select("homepage_config")
    .eq("user_id", uid)
    .maybeSingle();
  const config = (data?.homepage_config ?? null) as HomepageConfig | null;
  return config && typeof config === "object" ? config : {};
};

/**
 * A single picture that stands for the building in the gallery: its own
 * replacement artwork when it has one, otherwise the first front artwork
 * position that was changed.
 */
export const exteriorThumbnail = async (config: HomepageConfig): Promise<string | null> => {
  const custom = config.customBuilding as { src?: string } | null | undefined;
  if (custom?.src) return custom.src;
  const overrides = config.slotOverrides ?? {};
  for (const slot of RING_SLOTS) {
    const ref = overrides[slot.id];
    if (ref) {
      const url = await resolveMediaUrl(ref);
      if (url) return url;
    }
  }
  const first = Object.values(overrides)[0];
  return first ? await resolveMediaUrl(first) : null;
};

/**
 * Put a saved exterior back on this account's homepage building. The exterior
 * that is being replaced is filed away first.
 */
export const applyExterior = async (exterior: HomepageConfig | null): Promise<void> => {
  if (!exterior || Object.keys(exterior).length === 0) return;
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;

  const previous = await readMyExterior();
  if (Object.keys(previous).length > 0) {
    try {
      await snapshotBuilding("pro", previous);
    } catch (err) {
      console.error("previous exterior was not archived", err);
    }
  }

  const next = JSON.parse(JSON.stringify(exterior)) as HomepageConfig;
  const { error } = await supabase
    .from("profiles")
    .update({ homepage_config: next as never })
    .eq("user_id", uid);
  if (error) throw new Error(error.message);
  try {
    window.localStorage.setItem("mathgpl.homepage.config", JSON.stringify(next));
  } catch {
    /* noop */
  }
};
