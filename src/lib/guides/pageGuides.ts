// Page Guide videos.
//
// STORE ONCE → REFERENCE MANY. A guide video lives exactly once in the
// `page-guides` bucket and is referenced by its page's guide record. Only an
// account with the `platform_admin` capability may upload, replace, publish or
// delete; everyone else reads published guides only (enforced by RLS, not by
// hiding buttons).

import { supabase } from "@/integrations/supabase/client";

const BUCKET = "page-guides";

export interface PageGuide {
  id: string;
  pageKey: string;
  title: string;
  description: string | null;
  videoPath: string | null;
  status: "draft" | "published";
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

type Row = {
  id: string;
  page_key: string;
  title: string | null;
  description: string | null;
  video_path: string | null;
  status: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

/** The table is loosely typed until the generated types include it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase as any).from("page_guides");

const toGuide = (row: Row): PageGuide => ({
  id: row.id,
  pageKey: row.page_key,
  title: row.title ?? "",
  description: row.description,
  videoPath: row.video_path,
  status: row.status === "published" ? "published" : "draft",
  uploadedBy: row.uploaded_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** The guide for one page, or null. A missing table (before the guide system is
 *  live) is treated as "no guide" so no page can ever break. */
export const loadPageGuide = async (pageKey: string): Promise<PageGuide | null> => {
  try {
    const { data, error } = await table().select("*").eq("page_key", pageKey).maybeSingle();
    if (error || !data) return null;
    return toGuide(data as Row);
  } catch {
    return null;
  }
};

export const listPageGuides = async (): Promise<PageGuide[]> => {
  try {
    const { data, error } = await table().select("*").order("page_key");
    if (error || !data) return [];
    return (data as Row[]).map(toGuide);
  } catch {
    return [];
  }
};

/** A playable URL for a stored guide video. The bucket is public-read, so the
 *  same original object streams to every viewer — nothing is ever copied. */
export const guideVideoUrl = (videoPath: string | null): string | null => {
  if (!videoPath) return null;
  if (/^https?:\/\//i.test(videoPath)) return videoPath;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(videoPath);
  return data?.publicUrl ?? null;
};

export const uploadGuideVideo = async (pageKey: string, file: File): Promise<string> => {
  const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const path = `${pageKey.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
};

const removeObject = async (videoPath: string | null) => {
  if (!videoPath || /^https?:\/\//i.test(videoPath)) return;
  try {
    await supabase.storage.from(BUCKET).remove([videoPath]);
  } catch {
    /* the record is authoritative; a leftover object is harmless */
  }
};

export interface SaveGuideInput {
  pageKey: string;
  title: string;
  description?: string | null;
  /** A newly uploaded file. Replaces whatever the page had before. */
  file?: File | null;
  status?: "draft" | "published";
}

/** Creates or updates the guide for a page. Uploading a new file makes it the
 *  active guide immediately and removes the previous object. */
export const savePageGuide = async (input: SaveGuideInput): Promise<PageGuide> => {
  const existing = await loadPageGuide(input.pageKey);
  const { data: userData } = await supabase.auth.getUser();

  let videoPath = existing?.videoPath ?? null;
  if (input.file) {
    const next = await uploadGuideVideo(input.pageKey, input.file);
    if (videoPath && videoPath !== next) await removeObject(videoPath);
    videoPath = next;
  }

  const payload = {
    page_key: input.pageKey,
    title: input.title.trim() || input.pageKey,
    description: input.description?.trim() || null,
    video_path: videoPath,
    status: input.status ?? existing?.status ?? "draft",
    uploaded_by: userData.user?.id ?? existing?.uploadedBy ?? null,
  };

  const { data, error } = await table()
    .upsert(payload, { onConflict: "page_key" })
    .select("*")
    .single();
  if (error) throw error;
  return toGuide(data as Row);
};

export const setGuideStatus = async (pageKey: string, status: "draft" | "published"): Promise<void> => {
  const { error } = await table().update({ status }).eq("page_key", pageKey);
  if (error) throw error;
};

export const deletePageGuide = async (guide: PageGuide): Promise<void> => {
  const { error } = await table().delete().eq("page_key", guide.pageKey);
  if (error) throw error;
  await removeObject(guide.videoPath);
};
