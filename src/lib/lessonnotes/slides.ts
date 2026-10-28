// Slide Decks — the presentation workspace of ONE Lesson Note.
// Every query filters through `notebook_id`, so there is no global gallery by
// construction: Lesson Note B can never list Lesson Note A's decks.
import { supabase } from "@/integrations/supabase/client";
import { clampVisualZoom } from "@/lib/visualTransform";

const BUCKET = "slide-media";

/** One landscape coordinate system shared by editing, Preview and Smartboard. */
export const SLIDE_PAGE = { w: 1600, h: 900 } as const;

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
  /** Media scale inside its movable frame. Legacy items default to 100%. */
  zoom: number;
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

const LEGACY_ITEM_COLS = "id, slide_id, kind, storage_path, content_json, x, y, w, h, z, step";
const ITEM_COLS = `${LEGACY_ITEM_COLS}, zoom`;
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

/* --------------------------------------------------------------- canvases --
 * A "Canvas" is what the teacher sees: a named container whose Slides are its
 * pages. It is the same record as a deck — only the vocabulary changed. */
export type SlideCanvasRecord = SlideDeck;
export const listCanvases = listDecks;
export const createCanvas = createDeck;
export const renameCanvas = renameDeck;
export const deleteCanvas = deleteDeck;

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
  const query = await supabase
    .from("notebook_slide_items")
    .select(ITEM_COLS)
    .eq("slide_id", slideId)
    .order("step", { ascending: true })
    .order("z", { ascending: true });
  if (!query.error) return (query.data ?? []).map((row: any) => ({ ...row, zoom: clampVisualZoom(row.zoom) })) as SlideItem[];
  // Draft migrations apply only when accepted. Keep existing Canvas playback
  // working meanwhile, and give legacy rows their compatible 100% default.
  const legacy = await supabase
    .from("notebook_slide_items")
    .select(LEGACY_ITEM_COLS)
    .eq("slide_id", slideId)
    .order("step", { ascending: true })
    .order("z", { ascending: true });
  if (legacy.error) throw legacy.error;
  return (legacy.data ?? []).map((row: any) => ({ ...row, zoom: 1 })) as SlideItem[];
};

export const addSlideItem = async (
  slideId: string,
  item: Omit<SlideItem, "id" | "slide_id" | "content_json"> & { content_json?: unknown },
): Promise<SlideItem> => {
  const { data, error } = await supabase
    .from("notebook_slide_items")
    .insert({ slide_id: slideId, content_json: null, ...item, zoom: clampVisualZoom(item.zoom) } as never)
    .select(ITEM_COLS)
    .single();
  if (!error) return { ...(data as any), zoom: clampVisualZoom((data as any)?.zoom) } as SlideItem;
  const { zoom: _zoom, ...legacyItem } = item;
  const fallback = await supabase
    .from("notebook_slide_items")
    .insert({ slide_id: slideId, content_json: null, ...legacyItem } as never)
    .select(LEGACY_ITEM_COLS)
    .single();
  if (fallback.error) throw fallback.error;
  return { ...(fallback.data as any), zoom: 1 } as SlideItem;
};

export const updateSlideItem = async (
  id: string,
  patch: Partial<Pick<SlideItem, "x" | "y" | "w" | "h" | "z" | "step" | "zoom" | "content_json">>,
): Promise<void> => {
  const { error } = await supabase.from("notebook_slide_items").update(patch as never).eq("id", id);
  if (!error) return;
  if (!("zoom" in patch)) throw error;
  const { zoom: _zoom, ...legacyPatch } = patch;
  if (Object.keys(legacyPatch).length === 0) return;
  const fallback = await supabase.from("notebook_slide_items").update(legacyPatch as never).eq("id", id);
  if (fallback.error) throw fallback.error;
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

/** Prefix marking a slide item that REFERENCES an existing MyGPL library asset
 *  instead of holding its own uploaded copy. */
export const GPL_REF_PREFIX = "gpl:";

export const gplRef = (storagePath: string) => `${GPL_REF_PREFIX}${storagePath}`;

/** Signed display URL for a stored path (absolute links pass through). */
export const slideMediaUrl = async (value: string): Promise<string | null> => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith(GPL_REF_PREFIX)) {
    const { getSignedUrl } = await import("@/lib/games/urls");
    return getSignedUrl(value.slice(GPL_REF_PREFIX.length));
  }
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(value, 60 * 60 * 8);
  return data?.signedUrl ?? null;
};

/** The highest reveal step used on a slide (at least 1). */
export const maxStep = (items: SlideItem[]): number =>
  items.reduce((m, i) => Math.max(m, i.step), 1);

/** Slides (pages) of one Canvas, in presentation order. */
export const listCanvasSlides = listDeckSlides;
