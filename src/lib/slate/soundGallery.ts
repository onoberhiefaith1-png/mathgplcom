// The platform's official Sound Gallery.
//
// It lives in the existing official asset library (Session → Sub-Session →
// Asset), under one "Game Sounds" session with a separate sub-session per
// purpose, so the Game Sound selector only ever shows Game Sounds and the
// Vault selector only ever shows Vault sounds.
//
// Only an administrator can add to it — writes are guarded in the database by
// `can_manage_gpl_assets()`. Everyone may read it.

import { supabase } from "@/integrations/supabase/client";
import {
  createAsset,
  createSession,
  createSubSession,
  deleteAsset,
  getSessionBySlug,
  getSubSessionBySlug,
  listAssets,
  listSubSessions,
  updateAsset,
  uploadOfficialFile,
  type GplAsset,
} from "@/lib/gpl/assetLibrary";
import type { RewardSoundKey } from "./types";

export const SOUND_SESSION_SLUG = "game-sounds";
const SOUND_SESSION_NAME = "Game Sounds";

/** Which gallery a selector reads from. */
export type SoundPurpose = "background" | RewardSoundKey;

export const SOUND_PURPOSE_NAME: Record<SoundPurpose, string> = {
  background: "Game Sound",
  vault: "Vault Sound",
  bomb: "Bomb Sound",
  life: "Life Sound",
  hourglass: "Hourglass Sound",
  collector: "Collector Sound",
  completion: "Completion Coin Sound",
};

const SOUND_PURPOSES: SoundPurpose[] = [
  "background",
  "vault",
  "bomb",
  "life",
  "hourglass",
  "collector",
  "completion",
];

const purposeSlug = (purpose: SoundPurpose) => `${purpose}-sounds`;

/** True when the signed-in account may add to the official gallery. */
export const canManageSoundGallery = async (): Promise<boolean> => {
  const { data, error } = await supabase.rpc("can_manage_gpl_assets");
  if (error) return false;
  return data === true;
};

/** Reads one purpose's official sounds. Returns [] when nothing exists yet. */
export const listOfficialSounds = async (purpose: SoundPurpose): Promise<GplAsset[]> => {
  const session = await getSessionBySlug(SOUND_SESSION_SLUG);
  if (!session) return [];
  const sub = await getSubSessionBySlug(session.id, purposeSlug(purpose));
  if (!sub) return [];
  const assets = await listAssets(sub.id);
  return assets.filter((asset) => asset.is_active && asset.asset_type === "audio");
};

/**
 * Makes sure the Sound Gallery and its per-purpose folders exist. Administrator
 * only (the database refuses the writes for anyone else). Idempotent.
 */
export const ensureSoundGallery = async (purpose: SoundPurpose): Promise<string> => {
  let session = await getSessionBySlug(SOUND_SESSION_SLUG);
  if (!session) {
    session = await createSession({
      name: SOUND_SESSION_NAME,
      description: "Official sounds offered inside the Game.",
      sort_order: 900,
    });
  }
  const existing = await listSubSessions(session.id);
  const bySlug = new Map(existing.map((sub) => [sub.slug, sub]));
  let mine = bySlug.get(purposeSlug(purpose));
  if (!mine) {
    mine = await createSubSession({
      session_id: session.id,
      name: SOUND_PURPOSE_NAME[purpose],
      sort_order: SOUND_PURPOSES.indexOf(purpose),
    });
    // the slug is derived from the name, so pin the purpose slug explicitly
    await supabase
      .from("gpl_asset_subsessions")
      .update({ slug: purposeSlug(purpose) } as never)
      .eq("id", mine.id);
    mine = { ...mine, slug: purposeSlug(purpose) };
  }
  return mine.id;
};

/** Uploads one official sound into a purpose's gallery. Administrator only. */
export const addOfficialSound = async (
  purpose: SoundPurpose,
  file: File,
  name?: string,
): Promise<GplAsset> => {
  const subsessionId = await ensureSoundGallery(purpose);
  const path = await uploadOfficialFile(file, SOUND_SESSION_SLUG, purposeSlug(purpose));
  return createAsset({
    subsession_id: subsessionId,
    name: (name ?? file.name).replace(/\.[a-z0-9]+$/i, "") || file.name,
    asset_type: "audio",
    storage_path: path,
    media_type: "image",
  });
};

export const renameOfficialSound = (id: string, name: string) => updateAsset(id, { name });

export const reorderOfficialSound = (id: string, sort_order: number) =>
  updateAsset(id, { sort_order });

export const hideOfficialSound = (id: string, is_active: boolean) =>
  updateAsset(id, { is_active });

export const removeOfficialSound = (asset: GplAsset) => deleteAsset(asset);
