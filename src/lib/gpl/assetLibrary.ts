// Official GPL Asset library: Session → Sub-Session → Asset.
// Everything here is administrator-managed content stored in the database, so
// new sessions, sub-sessions and assets can be added without a developer.
// Teacher-owned libraries (game_assets, custom_assets, emoji_categories) are
// untouched by this module.

import { supabase } from "@/integrations/supabase/client";
import { GAME_ASSETS_BUCKET } from "@/lib/games/types";
import { assetCategories } from "@/data/assets";

export type GplAssetType = "image" | "transparent" | "gif" | "video" | "audio" | "emoji" | "model";

export interface GplSession {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface GplSubSession {
  id: string;
  session_id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface GplAsset {
  id: string;
  subsession_id: string;
  slug: string;
  name: string;
  description: string | null;
  asset_type: GplAssetType;
  storage_path: string | null;
  external_url: string | null;
  glyph: string | null;
  media_type: "image" | "video";
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const GPL_SURFACES = [
  "adventure",
  "building_editor",
  "lesson_notes",
  "smartboard_board_1",
  "smartboard_board_2",
  "emoji_library",
] as const;
export type GplSurface = (typeof GPL_SURFACES)[number];

export const SURFACE_LABEL: Record<GplSurface, string> = {
  adventure: "Adventure",
  building_editor: "Building Editor",
  lesson_notes: "Lesson Notes",
  smartboard_board_1: "Smartboard Board 1",
  smartboard_board_2: "Smartboard Board 2",
  emoji_library: "Emojis",
};


export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";

const table = <T>(rows: unknown): T[] => (rows ?? []) as T[];

/* ─── Reads ─────────────────────────────────────────────────────────── */

export const listSessions = async (): Promise<GplSession[]> => {
  const { data, error } = await supabase
    .from("gpl_asset_sessions")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return table<GplSession>(data);
};

export const getSessionBySlug = async (slug: string): Promise<GplSession | null> => {
  const { data, error } = await supabase
    .from("gpl_asset_sessions")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as GplSession | null;
};

export const listSubSessions = async (sessionId: string): Promise<GplSubSession[]> => {
  const { data, error } = await supabase
    .from("gpl_asset_subsessions")
    .select("*")
    .eq("session_id", sessionId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return table<GplSubSession>(data);
};

export const getSubSessionBySlug = async (
  sessionId: string,
  slug: string,
): Promise<GplSubSession | null> => {
  const { data, error } = await supabase
    .from("gpl_asset_subsessions")
    .select("*")
    .eq("session_id", sessionId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as GplSubSession | null;
};

export const listAssets = async (subsessionId: string): Promise<GplAsset[]> => {
  const { data, error } = await supabase
    .from("gpl_assets")
    .select("*")
    .eq("subsession_id", subsessionId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return table<GplAsset>(data);
};

export const countSubSessions = async (): Promise<Record<string, number>> => {
  const { data, error } = await supabase.from("gpl_asset_subsessions").select("session_id");
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of table<{ session_id: string }>(data)) {
    counts[row.session_id] = (counts[row.session_id] ?? 0) + 1;
  }
  return counts;
};

export const countAssets = async (
  subsessionIds: string[],
): Promise<Record<string, number>> => {
  if (!subsessionIds.length) return {};
  const { data, error } = await supabase
    .from("gpl_assets")
    .select("subsession_id")
    .in("subsession_id", subsessionIds);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of table<{ subsession_id: string }>(data)) {
    counts[row.subsession_id] = (counts[row.subsession_id] ?? 0) + 1;
  }
  return counts;
};

/** Search across all three levels; results carry their breadcrumb path. */
export interface GplSearchHit {
  kind: "session" | "subsession" | "asset";
  id: string;
  name: string;
  path: string;
  sessionSlug: string;
  subSessionSlug?: string;
}

export const searchLibrary = async (query: string): Promise<GplSearchHit[]> => {
  const q = query.trim();
  if (q.length < 2) return [];
  const [sessions, subs, assets] = await Promise.all([
    supabase.from("gpl_asset_sessions").select("*"),
    supabase.from("gpl_asset_subsessions").select("*"),
    supabase.from("gpl_assets").select("*"),
  ]);
  if (sessions.error) throw sessions.error;
  if (subs.error) throw subs.error;
  if (assets.error) throw assets.error;

  const sessionRows = table<GplSession>(sessions.data);
  const subRows = table<GplSubSession>(subs.data);
  const assetRows = table<GplAsset>(assets.data);
  const sessionById = new Map(sessionRows.map((s) => [s.id, s]));
  const subById = new Map(subRows.map((s) => [s.id, s]));
  const needle = q.toLowerCase();
  const matches = (...values: (string | null | undefined)[]) =>
    values.some((v) => (v ?? "").toLowerCase().includes(needle));

  const hits: GplSearchHit[] = [];
  for (const s of sessionRows) {
    if (matches(s.name, s.description, s.slug)) {
      hits.push({ kind: "session", id: s.id, name: s.name, path: s.name, sessionSlug: s.slug });
    }
  }
  for (const sub of subRows) {
    const parent = sessionById.get(sub.session_id);
    if (!parent) continue;
    if (matches(sub.name, sub.description, sub.slug)) {
      hits.push({
        kind: "subsession",
        id: sub.id,
        name: sub.name,
        path: `${parent.name} › ${sub.name}`,
        sessionSlug: parent.slug,
        subSessionSlug: sub.slug,
      });
    }
  }
  for (const asset of assetRows) {
    const sub = subById.get(asset.subsession_id);
    const parent = sub ? sessionById.get(sub.session_id) : undefined;
    if (!sub || !parent) continue;
    if (matches(asset.name, asset.description, asset.slug, asset.glyph)) {
      hits.push({
        kind: "asset",
        id: asset.id,
        name: asset.name,
        path: `${parent.name} › ${sub.name} › ${asset.name}`,
        sessionSlug: parent.slug,
        subSessionSlug: sub.slug,
      });
    }
  }
  return hits.slice(0, 60);
};

/* ─── Writes (RLS restricts these to the platform owner) ─────────────── */

export const canManageLibrary = async (): Promise<boolean> => {
  const { data, error } = await supabase.rpc("can_manage_gpl_assets");
  if (error) return false;
  return data === true;
};

export const createSession = async (input: {
  name: string;
  description?: string;
  icon?: string;
  image_url?: string;
  sort_order?: number;
}): Promise<GplSession> => {
  const { data, error } = await supabase
    .from("gpl_asset_sessions")
    .insert({
      slug: slugify(input.name),
      name: input.name,
      description: input.description ?? null,
      icon: input.icon ?? null,
      image_url: input.image_url ?? null,
      sort_order: input.sort_order ?? 0,
    } as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as GplSession;
};

export const updateSession = async (id: string, patch: Partial<GplSession>) => {
  const { error } = await supabase.from("gpl_asset_sessions").update(patch as never).eq("id", id);
  if (error) throw error;
};

export const deleteSession = async (id: string) => {
  const { error } = await supabase.from("gpl_asset_sessions").delete().eq("id", id);
  if (error) throw error;
};

export const createSubSession = async (input: {
  session_id: string;
  name: string;
  description?: string;
  image_url?: string;
  sort_order?: number;
}): Promise<GplSubSession> => {
  const { data, error } = await supabase
    .from("gpl_asset_subsessions")
    .insert({
      session_id: input.session_id,
      slug: slugify(input.name),
      name: input.name,
      description: input.description ?? null,
      image_url: input.image_url ?? null,
      sort_order: input.sort_order ?? 0,
    } as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as GplSubSession;
};

export const updateSubSession = async (id: string, patch: Partial<GplSubSession>) => {
  const { error } = await supabase
    .from("gpl_asset_subsessions")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
};

export const deleteSubSession = async (id: string) => {
  const { error } = await supabase.from("gpl_asset_subsessions").delete().eq("id", id);
  if (error) throw error;
};

export const createAsset = async (input: {
  subsession_id: string;
  name: string;
  asset_type: GplAssetType;
  description?: string;
  storage_path?: string | null;
  external_url?: string | null;
  glyph?: string | null;
  media_type?: "image" | "video";
  sort_order?: number;
}): Promise<GplAsset> => {
  const { data, error } = await supabase
    .from("gpl_assets")
    .insert({
      subsession_id: input.subsession_id,
      slug: `${slugify(input.name)}-${Math.random().toString(36).slice(2, 6)}`,
      name: input.name,
      description: input.description ?? null,
      asset_type: input.asset_type,
      storage_path: input.storage_path ?? null,
      external_url: input.external_url ?? null,
      glyph: input.glyph ?? null,
      media_type: input.media_type ?? (input.asset_type === "video" ? "video" : "image"),
      sort_order: input.sort_order ?? 0,
    } as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as GplAsset;
};

export const updateAsset = async (id: string, patch: Partial<GplAsset>) => {
  const { error } = await supabase.from("gpl_assets").update(patch as never).eq("id", id);
  if (error) throw error;
};

export const deleteAsset = async (asset: GplAsset) => {
  if (asset.storage_path) {
    await supabase.storage.from(GAME_ASSETS_BUCKET).remove([asset.storage_path]);
  }
  const { error } = await supabase.from("gpl_assets").delete().eq("id", asset.id);
  if (error) throw error;
};

/** Uploads an official file into the shared bucket under `official/`. */
export const uploadOfficialFile = async (file: File, sessionSlug: string, subSlug: string) => {
  const ext = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "bin";
  const path = `official/${sessionSlug}/${subSlug}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(GAME_ASSETS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;
  return path;
};

/* ─── Usage (where an asset is offered) ─────────────────────────────── */

export const listUsage = async (assetIds: string[]): Promise<Record<string, GplSurface[]>> => {
  if (!assetIds.length) return {};
  const { data, error } = await supabase
    .from("gpl_asset_usage")
    .select("asset_id, surface")
    .in("asset_id", assetIds);
  if (error) throw error;
  const map: Record<string, GplSurface[]> = {};
  for (const row of table<{ asset_id: string; surface: GplSurface }>(data)) {
    (map[row.asset_id] ??= []).push(row.surface);
  }
  return map;
};

export const setUsage = async (assetId: string, surfaces: GplSurface[]) => {
  const del = await supabase.from("gpl_asset_usage").delete().eq("asset_id", assetId);
  if (del.error) throw del.error;
  if (!surfaces.length) return;
  const { error } = await supabase
    .from("gpl_asset_usage")
    .insert(surfaces.map((surface) => ({ asset_id: assetId, surface })) as never);
  if (error) throw error;
};

/* ─── One-time import of the existing bundled catalogue ─────────────── */

const assetTypeOf = (src: string): GplAssetType => {
  const lower = src.toLowerCase();
  if (/\.(mp4|mov|webm)$/.test(lower)) return "video";
  if (/\.gif$/.test(lower)) return "gif";
  if (/\.(mp3|wav|ogg|m4a)$/.test(lower)) return "audio";
  if (/\.(glb|gltf|fbx|obj)$/.test(lower)) return "model";
  return "image";
};

export interface ImportReport {
  sessions: number;
  subSessions: number;
  assets: number;
  skipped: number;
}

/**
 * Registers the existing hard-coded catalogue as real rows, pointing at the
 * files already published. Idempotent: anything already present is skipped and
 * no file is copied or moved.
 */
export const importBundledCatalogue = async (): Promise<ImportReport> => {
  const report: ImportReport = { sessions: 0, subSessions: 0, assets: 0, skipped: 0 };
  const existingSessions = await listSessions();
  const sessionBySlug = new Map(existingSessions.map((s) => [s.slug, s]));

  for (const [ci, category] of assetCategories.entries()) {
    let session = sessionBySlug.get(category.slug);
    if (!session) {
      session = await createSession({ name: category.name, sort_order: ci });
      sessionBySlug.set(session.slug, session);
      report.sessions += 1;
    }

    const existingSubs = await listSubSessions(session.id);
    const subBySlug = new Map(existingSubs.map((s) => [s.slug, s]));

    for (const [si, sub] of category.subcategories.entries()) {
      let subSession = subBySlug.get(sub.slug);
      if (!subSession) {
        subSession = await createSubSession({
          session_id: session.id,
          name: sub.name,
          sort_order: si,
        });
        subBySlug.set(subSession.slug, subSession);
        report.subSessions += 1;
      }

      const flat = [
        ...(sub.assets ?? []),
        ...(sub.groups ?? []).flatMap((g) => g.assets),
      ];
      if (!flat.length) continue;

      const existingAssets = await listAssets(subSession.id);
      const known = new Set(existingAssets.map((a) => a.external_url ?? ""));
      const rows = flat
        .filter((item) => {
          if (known.has(item.src)) {
            report.skipped += 1;
            return false;
          }
          known.add(item.src);
          return true;
        })
        .map((item, index) => ({
          subsession_id: subSession!.id,
          slug: `${slugify(item.name)}-${Math.random().toString(36).slice(2, 6)}`,
          name: item.name,
          asset_type: assetTypeOf(item.src),
          external_url: item.src,
          media_type: assetTypeOf(item.src) === "video" ? "video" : "image",
          sort_order: index,
        }));
      if (!rows.length) continue;

      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error } = await supabase.from("gpl_assets").insert(chunk as never);
        if (error) throw error;
        report.assets += chunk.length;
      }
    }
  }
  return report;
};
