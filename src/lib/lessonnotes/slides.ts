// Slide — an additional workspace that belongs to ONE Lesson Note.
// Every query here filters on `notebook_id`, so there is no global gallery by
// construction: Lesson Note B can never list Lesson Note A's Slides.
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "slide-media";

export type SlideItemKind = "screenshot" | "image" | "video";

export interface SlideItem {
  id: string;
  slide_id: string;
  kind: SlideItemKind;
  storage_path: string;
  /** Fractions of the slide canvas (0..1). */
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  /** Reveal order during Preview / Smartboard presenting. */
  step: number;
}

export interface Slide {
  id: string;
  notebook_id: string;
  name: string;
  position: number;
}

export const listSlides = async (notebookId: string): Promise<Slide[]> => {
  const { data, error } = await supabase
    .from("notebook_slides")
    .select("id, notebook_id, name, position")
    .eq("notebook_id", notebookId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Slide[];
};

export const createSlide = async (notebookId: string, name: string): Promise<Slide> => {
  const existing = await listSlides(notebookId);
  const position = existing.length ? Math.max(...existing.map((s) => s.position)) + 1 : 0;
  const { data, error } = await supabase
    .from("notebook_slides")
    .insert({ notebook_id: notebookId, name: name.trim() || "Slide", position })
    .select("id, notebook_id, name, position")
    .single();
  if (error) throw error;
  return data as Slide;
};

export const renameSlide = async (id: string, name: string): Promise<void> => {
  const { error } = await supabase
    .from("notebook_slides")
    .update({ name: name.trim() || "Slide", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
};

export const deleteSlide = async (id: string): Promise<void> => {
  const { error } = await supabase.from("notebook_slides").delete().eq("id", id);
  if (error) throw error;
};

/** Swap two slides' positions so the manager can move one up or down. */
export const reorderSlides = async (slides: Slide[]): Promise<void> => {
  await Promise.all(
    slides.map((s, i) =>
      supabase.from("notebook_slides").update({ position: i }).eq("id", s.id),
    ),
  );
};

export const listSlideItems = async (slideId: string): Promise<SlideItem[]> => {
  const { data, error } = await supabase
    .from("notebook_slide_items")
    .select("id, slide_id, kind, storage_path, x, y, w, h, z, step")
    .eq("slide_id", slideId)
    .order("step", { ascending: true })
    .order("z", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SlideItem[];
};

export const addSlideItem = async (
  slideId: string,
  item: Omit<SlideItem, "id" | "slide_id">,
): Promise<SlideItem> => {
  const { data, error } = await supabase
    .from("notebook_slide_items")
    .insert({ slide_id: slideId, ...item })
    .select("id, slide_id, kind, storage_path, x, y, w, h, z, step")
    .single();
  if (error) throw error;
  return data as SlideItem;
};

export const updateSlideItem = async (
  id: string,
  patch: Partial<Pick<SlideItem, "x" | "y" | "w" | "h" | "z" | "step">>,
): Promise<void> => {
  const { error } = await supabase.from("notebook_slide_items").update(patch).eq("id", id);
  if (error) throw error;
};

export const deleteSlideItem = async (id: string): Promise<void> => {
  const { error } = await supabase.from("notebook_slide_items").delete().eq("id", id);
  if (error) throw error;
};

/** Upload a File/Blob into the teacher's own slide-media folder. */
export const uploadSlideMedia = async (
  notebookId: string,
  slideId: string,
  file: Blob,
  ext: string,
): Promise<string> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_signed_in");
  const path = `${uid}/${notebookId}/${slideId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
};

/** Signed display URL for a stored path (absolute links pass through). */
export const slideMediaUrl = async (value: string): Promise<string | null> => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(value, 60 * 60 * 8);
  return data?.signedUrl ?? null;
};

/** The highest reveal step used on a slide (at least 1). */
export const maxStep = (items: SlideItem[]): number =>
  items.reduce((m, i) => Math.max(m, i.step), 1);
