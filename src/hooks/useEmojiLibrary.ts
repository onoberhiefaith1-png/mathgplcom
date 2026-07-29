// Teacher-owned Emoji Library. Categories ("sessions") are stored per
// account so the same library is available in every lesson note.
// The app never generates emoji content — it only stores what the teacher pastes.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EmojiCategory {
  id: string;
  name: string;
  content: string;
  order_index: number;
}

/** Splits the pasted blob into individual clickable emoji tokens. */
export function splitEmojis(content: string): string[] {
  return content.split(/\s+/g).map((s) => s.trim()).filter(Boolean);
}

export function useEmojiLibrary(enabled = true) {
  const [categories, setCategories] = useState<EmojiCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("emoji_categories")
      .select("id, name, content, order_index")
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });
    if (!error && data) setCategories(data as EmojiCategory[]);
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

  return {
    categories, loading, reload: load,
    createCategory, renameCategory, saveContent, deleteCategory, moveCategory,
  };
}
