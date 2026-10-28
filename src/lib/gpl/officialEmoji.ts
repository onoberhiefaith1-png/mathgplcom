// Official GPL emoji — one central record, read by every surface
// (Lesson Notes, Smartboard Board 1, Smartboard Board 2). Deactivating an
// emoji in /admin/assets removes it everywhere at once.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Slug of the Session that holds the official emoji. */
export const EMOJI_SESSION_SLUG = "emoji";

export interface OfficialEmojiGroup {
  id: string;
  name: string;
  glyphs: { id: string; glyph: string; name: string }[];
}

let cache: OfficialEmojiGroup[] | null = null;
let inflight: Promise<OfficialEmojiGroup[]> | null = null;

export const fetchOfficialEmoji = async (): Promise<OfficialEmojiGroup[]> => {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const session = await supabase
      .from("gpl_asset_sessions")
      .select("id")
      .eq("slug", EMOJI_SESSION_SLUG)
      .maybeSingle();
    const sessionId = (session.data as { id: string } | null)?.id;
    if (!sessionId) return [];

    const subs = await supabase
      .from("gpl_asset_subsessions")
      .select("id, name, sort_order, is_active")
      .eq("session_id", sessionId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    const groups = (subs.data ?? []) as { id: string; name: string }[];
    if (!groups.length) return [];

    const assets = await supabase
      .from("gpl_assets")
      .select("id, name, glyph, subsession_id, sort_order, is_active")
      .in("subsession_id", groups.map((g) => g.id))
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    const rows = (assets.data ?? []) as {
      id: string;
      name: string;
      glyph: string | null;
      subsession_id: string;
    }[];

    const out = groups
      .map((g) => ({
        id: g.id,
        name: g.name,
        glyphs: rows
          .filter((r) => r.subsession_id === g.id && r.glyph)
          .map((r) => ({ id: r.id, glyph: r.glyph as string, name: r.name })),
      }))
      .filter((g) => g.glyphs.length > 0);

    cache = out;
    return out;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
};

/** Clears the in-memory cache after an administrator edits the emoji session. */
export const invalidateOfficialEmoji = () => {
  cache = null;
};

export function useOfficialEmoji(enabled = true) {
  const [groups, setGroups] = useState<OfficialEmojiGroup[]>(cache ?? []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setLoading(true);
    fetchOfficialEmoji()
      .then((g) => {
        if (alive) setGroups(g);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [enabled]);

  return { groups, loading };
}
