/**
 * Buildings shelf of the GPL Assets library.
 *
 * A building is a configuration (background, 16 artwork slots, optional
 * replacement building) — not a media file. Every time a building page saves,
 * the resulting configuration is snapshotted here as a new, reusable asset so
 * an earlier building can always be brought back. Snapshots are never
 * overwritten.
 */
import { supabase } from "@/integrations/supabase/client";
import type { HomepageConfig } from "./homepageConfig";
import { fetchPlatformFreeBuilding } from "./homepageConfig";
import type { BuildingVersionKey } from "./buildingSlots";

export interface BuildingAssetRow {
  id: string;
  owner_id: string;
  version: string;
  name: string;
  config: HomepageConfig;
  created_at: string;
}

const SELECT = "id, owner_id, version, name, config, created_at";

const stamp = () =>
  new Date().toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export const buildingLabel = (version: BuildingVersionKey) =>
  version === "free" ? "Free Building" : "Pro Building";

const sameConfig = (a: HomepageConfig, b: HomepageConfig) =>
  JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});

export const listBuildingAssets = async (): Promise<BuildingAssetRow[]> => {
  const { data, error } = await supabase
    .from("building_assets")
    .select(SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as BuildingAssetRow[];
};

/** Store one configuration as a new building asset. */
export const snapshotBuilding = async (
  version: BuildingVersionKey,
  config: HomepageConfig,
  name?: string,
): Promise<BuildingAssetRow | null> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  if (!config || Object.keys(config).length === 0) return null;

  // Pressing Save twice without changing anything should not pile up copies.
  const { data: latest } = await supabase
    .from("building_assets")
    .select(SELECT)
    .eq("owner_id", uid)
    .eq("version", version)
    .order("created_at", { ascending: false })
    .limit(1);
  const previous = (latest ?? [])[0] as unknown as BuildingAssetRow | undefined;
  if (previous && sameConfig(previous.config, config)) return previous;

  const { data, error } = await supabase
    .from("building_assets")
    .insert({
      owner_id: uid,
      version,
      name: name ?? `${buildingLabel(version)} — ${stamp()}`,
      config: config as never,
    } as never)
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as unknown as BuildingAssetRow;
};

/**
 * Register the buildings that already exist (Pro from this account, Free from
 * the platform record) so they appear in the library exactly as they are.
 * Runs at most once per building — a matching snapshot is never duplicated.
 */
export const ensureCurrentBuildingsRegistered = async (options?: {
  includeFree?: boolean;
}): Promise<void> => {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;

  const existing = await listBuildingAssets();
  const has = (version: BuildingVersionKey, config: HomepageConfig) =>
    existing.some((row) => row.version === version && sameConfig(row.config, config));

  const { data: profile } = await supabase
    .from("profiles")
    .select("homepage_config")
    .eq("user_id", uid)
    .maybeSingle();
  const pro = (profile?.homepage_config ?? null) as HomepageConfig | null;
  if (pro && Object.keys(pro).length > 0 && !has("pro", pro)) {
    await snapshotBuilding("pro", pro, `${buildingLabel("pro")} — current`);
  }

  if (options?.includeFree) {
    const free = await fetchPlatformFreeBuilding();
    if (Object.keys(free).length > 0 && !has("free", free)) {
      await snapshotBuilding("free", free, `${buildingLabel("free")} — current`);
    }
  }
};

/** Restore a snapshot onto the Pro building of this account, or the Free building. */
export const applyBuildingAsset = async (
  row: BuildingAssetRow,
  target: BuildingVersionKey,
): Promise<void> => {
  const config = JSON.parse(JSON.stringify(row.config ?? {})) as HomepageConfig;
  if (target === "free") {
    const { error } = await supabase.rpc("set_platform_free_building", {
      _config: config as never,
    });
    if (error) throw error;
    return;
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Sign in to apply a building");
  const { error } = await supabase
    .from("profiles")
    .update({ homepage_config: config as never })
    .eq("user_id", userData.user.id);
  if (error) throw error;
};

export const renameBuildingAsset = async (id: string, name: string) => {
  const { error } = await supabase
    .from("building_assets")
    .update({ name } as never)
    .eq("id", id);
  if (error) throw error;
};

export const deleteBuildingAsset = async (id: string) => {
  const { error } = await supabase.from("building_assets").delete().eq("id", id);
  if (error) throw error;
};
