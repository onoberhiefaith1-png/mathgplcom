// Tutorial videos for a page.
//
// STORE ONCE → REFERENCE MANY. Every tutorial video lives exactly once in the
// `page-guides` bucket and is referenced by its page's tutorial rows. A page may
// hold SEVERAL tutorials, in a deliberate order — there is no auto-advance, the
// viewer always picks.
//
// Only a platform administrator or an Asset Manager may add, replace, reorder or
// remove; everyone else reads published tutorials only (enforced by RLS, not by
// hiding buttons).

import { supabase } from "@/integrations/supabase/client";
import { loadPageGuide, guideVideoUrl, uploadGuideVideo } from "./pageGuides";

const BUCKET = "page-guides";

export interface Tutorial {
  id: string;
  pageKey: string;
  title: string;
  description: string | null;
  videoPath: string;
  position: number;
  status: "draft" | "published";
  /** True when the row comes from the older single-guide table. */
  legacy?: boolean;
}

type Row = {
  id: string;
  page_key: string;
  title: string | null;
  description: string | null;
  video_path: string | null;
  position: number | null;
  status: string | null;
};

/** Loosely typed until the generated database types include the table. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase as any).from("page_guide_videos");

const toTutorial = (row: Row): Tutorial => ({
  id: row.id,
  pageKey: row.page_key,
  title: row.title ?? "",
  description: row.description,
  videoPath: row.video_path ?? "",
  position: row.position ?? 0,
  status: row.status === "draft" ? "draft" : "published",
});

export const tutorialVideoUrl = guideVideoUrl;

/**
 * Every tutorial for a page, in order. The legacy single guide (if any) is
 * treated as the first tutorial, so nothing already uploaded is lost — and a
 * missing table simply means "only the legacy guide", never a broken page.
 */
export const loadTutorials = async (pageKey: string): Promise<Tutorial[]> => {
  const list: Tutorial[] = [];

  const legacy = await loadPageGuide(pageKey);
  if (legacy?.videoPath) {
    list.push({
      id: `legacy:${legacy.id}`,
      pageKey,
      title: legacy.title || "Tutorial",
      description: legacy.description,
      videoPath: legacy.videoPath,
      position: -1,
      status: legacy.status,
      legacy: true,
    });
  }

  try {
    const { data, error } = await table()
      .select("*")
      .eq("page_key", pageKey)
      .order("position")
      .order("created_at");
    if (!error && data) list.push(...(data as Row[]).map(toTutorial).filter((t) => t.videoPath));
  } catch {
    /* the table may not exist yet; the legacy guide still plays */
  }

  return list;
};

export interface AddTutorialInput {
  pageKey: string;
  title: string;
  description?: string | null;
  file: File;
  status?: "draft" | "published";
}

export const addTutorial = async (input: AddTutorialInput): Promise<Tutorial> => {
  const videoPath = await uploadGuideVideo(input.pageKey, input.file);
  const existing = await loadTutorials(input.pageKey);
  const { data: userData } = await supabase.auth.getUser();

  const { data, error } = await table()
    .insert({
      page_key: input.pageKey,
      title: input.title.trim() || "Tutorial",
      description: input.description?.trim() || null,
      video_path: videoPath,
      position: existing.length,
      status: input.status ?? "published",
      uploaded_by: userData.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toTutorial(data as Row);
};

/** Replaces the video file of one tutorial, keeping its place in the order. */
export const replaceTutorialVideo = async (tutorial: Tutorial, file: File): Promise<Tutorial> => {
  const videoPath = await uploadGuideVideo(tutorial.pageKey, file);
  const { data, error } = await table()
    .update({ video_path: videoPath })
    .eq("id", tutorial.id)
    .select("*")
    .single();
  if (error) throw error;
  if (tutorial.videoPath && !/^https?:/i.test(tutorial.videoPath)) {
    await supabase.storage.from(BUCKET).remove([tutorial.videoPath]).catch(() => undefined);
  }
  return toTutorial(data as Row);
};

export const updateTutorial = async (
  id: string,
  patch: { title?: string; description?: string | null; status?: "draft" | "published"; position?: number },
): Promise<void> => {
  const { error } = await table().update(patch).eq("id", id);
  if (error) throw error;
};

export const removeTutorial = async (tutorial: Tutorial): Promise<void> => {
  const { error } = await table().delete().eq("id", tutorial.id);
  if (error) throw error;
  if (tutorial.videoPath && !/^https?:/i.test(tutorial.videoPath)) {
    await supabase.storage.from(BUCKET).remove([tutorial.videoPath]).catch(() => undefined);
  }
};

/** Moves one tutorial up or down, then writes the whole order back. */
export const reorderTutorials = async (list: Tutorial[]): Promise<void> => {
  await Promise.all(
    list
      .filter((t) => !t.legacy)
      .map((t, index) => updateTutorial(t.id, { position: index })),
  );
};
