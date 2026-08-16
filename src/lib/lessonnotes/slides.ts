// Slide Decks — the presentation workspace of ONE Lesson Note.
// Every query filters through `notebook_id`, so there is no global gallery by
// construction: Lesson Note B can never list Lesson Note A's decks.
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "slide-media";

/** The slide page in note pixels (A4 at 96dpi) — the same coordinate space as
 *  the lesson-note sheet, so a captured expression keeps its original size. */
export const SLIDE_PAGE = { w: 794, h: 1123 } as const;

export type SlideItemKind = "screenshot" | "image" | "video" | "content";

export interface SlideItem {
  id: string;
  slide_id: string;
  kind: SlideItemKind;
  storage_path: string;
  /** Live lesson-note nodes for `content` items (TipTap JSON array). */
  content_json: unknown | null;
  /** Fractions of the slide page (0..1). */
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
  deck_id: string | null;
  name: string;
  position: number;
}

export interface SlideDeck {
  id: string;
  notebook_id: string;
  name: string;
  position: number;
}

const ITEM_COLS = "id, slide_id, kind, storage_path, content_json, x, y, w, h, z, step";
const SLIDE_COLS = "id, notebook_id, deck_id, name, position";

/* ----------------------------------------------------------------- decks -- */

export const listDecks = async (notebookId: string): Promise<SlideDeck[]> => {
  const { data, error } = await supabase
    .from("notebook_slide_decks")
    .select("id, notebook_id, name, position")
    .eq("notebook_id", notebookId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SlideDeck[];
};

export const createDeck = async (notebookId: string, name: string): Promise<SlideDeck> => {
  const existing = await listDecks(notebookId);
  const position = existing.length ? Math.max(...existing.map((d) => d.position)) + 1 : 0;
  const { data, error } = await supabase
    .from("notebook_slide_decks")
    .insert({ notebook_id: notebookId, name: name.trim() || "Slide Deck", position })
    .select("id, notebook_id, name, position")
    .single();
  if (error) throw error;
  return data as SlideDeck;
};

export const renameDeck = async (id: string, name: string): Promise<void> => {
  const { error } = await supabase
    .from("notebook_slide_decks")
    .update({ name: name.trim() || "Slide Deck" })
    .eq("id", id);
  if (error) throw error;
};

export const deleteDeck = async (id: string): Promise<void> => {
  const { error } = await supabase.from("notebook_slide_decks").delete().eq("id", id);
  if (error) throw error;
};

/* ---------------------------------------------------------------- slides -- */

/** Slides of one deck, in presentation order. */
export const listDeckSlides = async (deckId: string): Promise<Slide[]> => {
  const { data, error } = await supabase
    .from("notebook_slides")
    .select(SLIDE_COLS)
    .eq("deck_id", deckId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Slide[];
};

/** Every slide of a note (used only for legacy/no-deck fallbacks). */
export const listSlides = async (notebookId: string): Promise<Slide[]> => {
  const { data, error } = await supabase
    .from("notebook_slides")
    .select(SLIDE_COLS)
    .eq("notebook_id", notebookId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Slide[];
};

export const createSlide = async (
  notebookId: string,
  deckId: string,
  name: string,
): Promise<Slide> => {
  const existing = await listDeckSlides(deckId);
  const position = existing.length ? Math.max(...existing.map((s) => s.position)) + 1 : 0;
  const { data, error } = await supabase
    .from("notebook_slides")
    .insert({ notebook_id: notebookId, deck_id: deckId, name: name.trim() || "Slide", position })
    .select(SLIDE_COLS)
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

/** Persist the current display order of a deck's slides. */
export const reorderSlides = async (slides: Slide[]): Promise<void> => {
  await Promise.all(
    slides.map((s, i) =>
      supabase.from("notebook_slides").update({ position: i }).eq("id", s.id),
    ),
  );
};

/* ----------------------------------------------------------------- items -- */

export const listSlideItems = async (slideId: string): Promise<SlideItem[]> => {
  const { data, error } = await supabase
    .from("notebook_slide_items")
    .select(ITEM_COLS)
    .eq("slide_id", slideId)
    .order("step", { ascending: true })
    .order("z", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SlideItem[];
};

export const addSlideItem = async (
  slideId: string,
  item: Omit<SlideItem, "id" | "slide_id" | "content_json"> & { content_json?: unknown },
): Promise<SlideItem> => {
  const { data, error } = await supabase
    .from("notebook_slide_items")
    .insert({ slide_id: slideId, content_json: null, ...item } as never)
    .select(ITEM_COLS)
    .single();
  if (error) throw error;
  return data as SlideItem;
};

export const updateSlideItem = async (
  id: string,
  patch: Partial<Pick<SlideItem, "x" | "y" | "w" | "h" | "z" | "step" | "content_json">>,
): Promise<void> => {
  const { error } = await supabase.from("notebook_slide_items").update(patch as never).eq("id", id);
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
