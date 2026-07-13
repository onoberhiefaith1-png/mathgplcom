// Upload + CRUD for the teacher's game asset library.
import { supabase } from "@/integrations/supabase/client";
import { AssetKind, GAME_ASSETS_BUCKET, GameAssetRow } from "./types";
import { isVideoFile, makeTransparent, mediaTypeOf } from "./removeBackground";

const rand = () => Math.random().toString(36).slice(2, 10);

const extOf = (name: string) => {
  const m = name.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "bin";
};

export interface UploadResult {
  asset: GameAssetRow;
}

export const uploadGameAsset = async (
  file: File,
  kind: AssetKind,
  title: string,
): Promise<GameAssetRow> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");

  const mediaType = mediaTypeOf(file);
  const base = `${uid}/${kind}/${Date.now()}-${rand()}`;

  const origPath = `${base}.${extOf(file.name)}`;
  const up1 = await supabase.storage
    .from(GAME_ASSETS_BUCKET)
    .upload(origPath, file, { contentType: file.type || undefined, upsert: false });
  if (up1.error) throw up1.error;

  let processedPath: string | null = null;
  let processedStatus: GameAssetRow["processed_status"] = "none";

  const needsTransparency =
    (kind === "reward" || kind === "progress_bar" || kind === "effect") &&
    mediaType === "image";

  if (needsTransparency) {
    try {
      const transparent = await makeTransparent(file);
      const procPath = `${base}-transparent.png`;
      const up2 = await supabase.storage
        .from(GAME_ASSETS_BUCKET)
        .upload(procPath, transparent, { contentType: "image/png", upsert: false });
      if (up2.error) throw up2.error;
      processedPath = procPath;
      processedStatus = "done";
    } catch (err) {
      console.error("transparency processing failed", err);
      processedStatus = "failed";
    }
  }

  const { data, error } = await supabase
    .from("game_assets")
    .insert({
      owner_id: uid,
      kind,
      media_type: mediaType,
      title: title || file.name,
      storage_path: origPath,
      processed_path: processedPath,
      processed_status: processedStatus,
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as GameAssetRow;
};

export const importUrlAsGameAsset = async (
  url: string,
  kind: AssetKind,
  title: string,
): Promise<GameAssetRow> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch asset (${res.status})`);
  const blob = await res.blob();
  const base = url.split("/").pop()?.split("?")[0] || "asset";
  const name = /\.[a-z0-9]+$/i.test(base) ? base : `${base}.${extOf(base)}`;
  const file = new File([blob], name, { type: blob.type || undefined });
  return uploadGameAsset(file, kind, title || base);
};

export const listGameAssets = async (kind?: AssetKind): Promise<GameAssetRow[]> => {
  let q = supabase.from("game_assets").select("*").order("created_at", { ascending: false });
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as GameAssetRow[];
};

export const deleteGameAsset = async (asset: GameAssetRow): Promise<void> => {
  const paths = [asset.storage_path, asset.processed_path].filter(Boolean) as string[];
  if (paths.length) {
    await supabase.storage.from(GAME_ASSETS_BUCKET).remove(paths);
  }
  const { error } = await supabase.from("game_assets").delete().eq("id", asset.id);
  if (error) throw error;
};

export const renderPathOf = (asset: GameAssetRow): string =>
  asset.processed_path ?? asset.storage_path;

export { isVideoFile };
