// Stores AI-generated notebook cover artwork in the private game-assets bucket.
import { supabase } from "@/integrations/supabase/client";
import { GAME_ASSETS_BUCKET } from "@/lib/games/types";

const b64ToBlob = (b64: string): Blob => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "image/png" });
};

/** Uploads a base64 PNG cover and returns its storage path. */
export const uploadCoverArt = async (b64: string, notebookId: string): Promise<string> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");

  const path = `${uid}/notebook-covers/${notebookId}-${Date.now()}.png`;
  const { error } = await supabase.storage
    .from(GAME_ASSETS_BUCKET)
    .upload(path, b64ToBlob(b64), { contentType: "image/png", upsert: true });
  if (error) throw error;
  return path;
};
