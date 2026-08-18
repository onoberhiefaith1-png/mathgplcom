// Items inside a teacher's emoji session. A session can hold Unicode emojis,
// pictures/videos uploaded or pasted from the teacher's computer, and items
// copied from the GPL Asset library.

import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/games/urls";

const TEACHER_BUCKET = "slide-media";
const GPL_BUCKET = "game-assets";

export type EmojiItemKind = "glyph" | "image" | "video";
export type EmojiItemBucket = "teacher" | "gpl" | "url";

export interface EmojiItem {
  id: string;
  category_id: string;
  kind: EmojiItemKind;
  glyph: string | null;
  storage_path: string | null;
  external_url: string | null;
  name: string;
  order_index: number;
}

const rows = <T>(data: unknown): T[] => (data ?? []) as T[];

export const listEmojiItems = async (categoryIds: string[]): Promise<EmojiItem[]> => {
  if (!categoryIds.length) return [];
  const { data, error } = await supabase
    .from("emoji_items")
    .select("id, category_id, kind, glyph, storage_path, external_url, name, order_index")
    .in("category_id", categoryIds)
    .order("order_index", { ascending: true });
  if (error) return [];
  return rows<EmojiItem>(data);
};

/** Uploads a file into the teacher's own private folder. */
export const uploadEmojiFile = async (file: File): Promise<string> => {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("not_signed_in");
  const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? "png").toLowerCase();
  const path = `${uid}/emoji/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(TEACHER_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: true });
  if (error) throw error;
  return path;
};

export interface NewEmojiItem {
  category_id: string;
  kind: EmojiItemKind;
  glyph?: string | null;
  storage_path?: string | null;
  external_url?: string | null;
  name?: string;
  /** Which private bucket `storage_path` lives in. */
  bucket?: EmojiItemBucket;
}

export const addEmojiItems = async (
  items: NewEmojiItem[],
  startIndex = 0,
): Promise<EmojiItem[]> => {
  if (!items.length) return [];
  const { data: auth } = await supabase.auth.getUser();
  const owner = auth.user?.id;
  if (!owner) return [];
  const payload = items.map((item, i) => ({
    owner_id: owner,
    category_id: item.category_id,
    kind: item.kind,
    glyph: item.glyph ?? null,
    // GPL items are stored as a bucket-qualified path so the reader knows
    // which private bucket to sign against.
    storage_path: item.storage_path
      ? item.bucket === "gpl"
        ? `gpl:${item.storage_path}`
        : item.storage_path
      : null,
    external_url: item.external_url ?? null,
    name: item.name ?? "",
    order_index: startIndex + i,
  }));
  const { data, error } = await supabase
    .from("emoji_items")
    .insert(payload as never)
    .select("id, category_id, kind, glyph, storage_path, external_url, name, order_index");
  if (error) return [];
  return rows<EmojiItem>(data);
};

export const deleteEmojiItem = async (id: string) => {
  await supabase.from("emoji_items").delete().eq("id", id);
};

/** Signed display URL for an item's stored path (absolute links pass through). */
export const emojiMediaUrl = async (value: string): Promise<string | null> => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value;
  if (value.startsWith("gpl:")) return getSignedUrl(value.slice(4));
  const { data } = await supabase.storage
    .from(TEACHER_BUCKET)
    .createSignedUrl(value, 60 * 60 * 8);
  return data?.signedUrl ?? null;
};

export { TEACHER_BUCKET as EMOJI_BUCKET, GPL_BUCKET as EMOJI_GPL_BUCKET };
