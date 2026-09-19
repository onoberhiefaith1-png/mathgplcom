// Uploaded Slate assets (the teacher's own sun image and background music).
//
// Slate Art keeps these files in the browser. In MathGPL they belong to the
// account, so students on any device see the same slate: every file lives in
// the shared `game-assets` bucket under `<owner id>/slate-assets/<file>`, and
// the saved game only ever stores that object path.

import { supabase } from "@/integrations/supabase/client";

const BUCKET = "game-assets";
export const MAX_ASSET_BYTES = 1000 * 1024 * 1024; // 1 GB

const extension = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot).toLowerCase() : "";
};

/** Uploads one file and returns the stored path, which is the asset id. */
export async function putAsset(file: File): Promise<string> {
  if (file.size > MAX_ASSET_BYTES) throw new Error("That file is too large (1 GB maximum).");
  const { data: auth } = await supabase.auth.getUser();
  const owner = auth.user?.id;
  if (!owner) throw new Error("Please sign in before uploading.");
  const name = `${crypto.randomUUID()}${extension(file.name)}`;
  const path = `${owner}/slate-assets/${name}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

const urls = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

/** A usable URL for a stored asset, cached for the lifetime of the page. */
export async function assetUrl(id: string): Promise<string | null> {
  const cached = urls.get(id);
  if (cached) return cached;
  const inflight = pending.get(id);
  if (inflight) return inflight;
  const request = (async () => {
    // legacy browser-only ids (a_xxx) can no longer be resolved
    if (!id.includes("/")) return null;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(id, 60 * 60 * 12);
    if (error || !data?.signedUrl) return null;
    urls.set(id, data.signedUrl);
    return data.signedUrl;
  })();
  pending.set(id, request);
  const url = await request;
  pending.delete(id);
  return url;
}

export async function removeAsset(id: string) {
  urls.delete(id);
  if (!id.includes("/")) return;
  await supabase.storage.from(BUCKET).remove([id]);
}
