// Teacher-owned Emoji Library. Categories ("sessions") are stored per
// account so the same library is available in every lesson note.
// The app never generates emoji content — it only stores what the teacher
// pastes, uploads, or copies from the GPL Asset library.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  addEmojiItems, deleteEmojiItem, listEmojiItems, uploadEmojiFile,
  type EmojiItem,
} from "@/lib/lessonnotes/emojiItems";
import type { GplAsset } from "@/lib/gpl/assetLibrary";

export interface EmojiCategory {
  id: string;
  name: string;
  content: string;
  order_index: number;
}

export type { EmojiItem };

/** Splits the pasted blob into individual clickable emoji tokens. */
export function splitEmojis(content: string): string[] {
  return content.split(/\s+/g).map((s) => s.trim()).filter(Boolean);
}

const kindOfFile = (file: File): "image" | "video" =>
  /^video\//.test(file.type) ? "video" : "image";

export function useEmojiLibrary(enabled = true) {
  const [categories, setCategories] = useState<EmojiCategory[]>([]);
  const [items, setItems] = useState<EmojiItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("emoji_categories")
      .select("id, name, content, order_index")
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });
    if (!error && data) {
      const list = data as EmojiCategory[];
      setCategories(list);
      setItems(await listEmojiItems(list.map((c) => c.id)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  const createCategory = useCallback(async (name: string) => {
    const { data: auth } = await supabase.auth.getUser();
    const owner = auth.user?.id;
    if (!owner) return null;
    const nextIndex = categories.length
      ? Math.max(...categories.map((c) => c.order_index)) + 1
      : 0;
    const { data, error } = await supabase
      .from("emoji_categories")
      .insert({ owner_id: owner, name, content: "", order_index: nextIndex })
      .select("id, name, content, order_index")
      .single();
    if (error || !data) return null;
    setCategories((prev) => [...prev, data as EmojiCategory]);
    return data as EmojiCategory;
  }, [categories]);

  const renameCategory = useCallback(async (id: string, name: string) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    await supabase.from("emoji_categories").update({ name }).eq("id", id);
  }, []);

  const saveContent = useCallback(async (id: string, content: string) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, content } : c)));
    await supabase.from("emoji_categories").update({ content }).eq("id", id);
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setItems((prev) => prev.filter((i) => i.category_id !== id));
    await supabase.from("emoji_categories").delete().eq("id", id);
  }, []);

  /** Moves a category up (-1) or down (+1) and persists the new order. */
  const moveCategory = useCallback(async (id: string, delta: -1 | 1) => {
    const ordered = [...categories];
    const i = ordered.findIndex((c) => c.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    const renumbered = ordered.map((c, idx) => ({ ...c, order_index: idx }));
    setCategories(renumbered);
    await Promise.all(
      renumbered.map((c) =>
        supabase.from("emoji_categories").update({ order_index: c.order_index }).eq("id", c.id),
      ),
    );
  }, [categories]);

  const nextIndexFor = useCallback(
    (categoryId: string) => {
      const own = items.filter((i) => i.category_id === categoryId);
      return own.length ? Math.max(...own.map((i) => i.order_index)) + 1 : 0;
    },
    [items],
  );

  /** Stores pasted/dropped/uploaded pictures & videos inside a session. */
  const addFiles = useCallback(
    async (categoryId: string, files: File[]) => {
      const media = files.filter((f) => /^(image|video)\//.test(f.type));
      if (!media.length) return [];
      setBusy(true);
      try {
        const uploaded = await Promise.all(
          media.map(async (file) => ({
            category_id: categoryId,
            kind: kindOfFile(file),
            storage_path: await uploadEmojiFile(file),
            name: file.name.replace(/\.[a-z0-9]+$/i, ""),
            bucket: "teacher" as const,
          })),
        );
        const created = await addEmojiItems(uploaded, nextIndexFor(categoryId));
        setItems((prev) => [...prev, ...created]);
        return created;
      } finally {
        setBusy(false);
      }
    },
    [nextIndexFor],
  );

  /** Stores a pasted image/video link inside a session. */
  const addLink = useCallback(
    async (categoryId: string, url: string) => {
      const kind = /\.(mp4|mov|webm)(\?|$)/i.test(url) ? "video" : "image";
      const created = await addEmojiItems(
        [{ category_id: categoryId, kind, external_url: url, name: "Pasted link", bucket: "url" }],
        nextIndexFor(categoryId),
      );
      setItems((prev) => [...prev, ...created]);
      return created;
    },
    [nextIndexFor],
  );

  /** Copies an official GPL asset into a session. */
  const addGplAsset = useCallback(
    async (categoryId: string, asset: GplAsset) => {
      const base = { category_id: categoryId, name: asset.name };
      const item =
        asset.asset_type === "emoji" && asset.glyph
          ? { ...base, kind: "glyph" as const, glyph: asset.glyph }
          : asset.storage_path
            ? {
                ...base,
                kind: (asset.media_type === "video" ? "video" : "image") as "image" | "video",
                storage_path: asset.storage_path,
                bucket: "gpl" as const,
              }
            : {
                ...base,
                kind: (asset.media_type === "video" ? "video" : "image") as "image" | "video",
                external_url: asset.external_url ?? "",
                bucket: "url" as const,
              };
      const created = await addEmojiItems([item], nextIndexFor(categoryId));
      setItems((prev) => [...prev, ...created]);
      return created;
    },
    [nextIndexFor],
  );

  const removeItem = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await deleteEmojiItem(id);
  }, []);

  return {
    categories, items, loading, busy, reload: load,
    createCategory, renameCategory, saveContent, deleteCategory, moveCategory,
    addFiles, addLink, addGplAsset, removeItem,
  };
}
