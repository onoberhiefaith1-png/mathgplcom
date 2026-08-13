// Per-account Homepage look: background layer + building layer.
// The two layers are stored independently and never overwrite each other.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/games/urls";
import type { CanvasElement, MediaSource, MediaType } from "@/lib/games/types";

export interface HomepageMediaRef {
  /** storage object path, or a public URL when source === "url" */
  path: string;
  source: MediaSource;
  mediaType: MediaType;
}

export type BuildingMode = "mathgpl" | "custom";

export interface HomepageConfig {
  /** Layer behind the building. Null/absent = shipped clouds artwork. */
  background?: HomepageMediaRef | null;
  buildingMode?: BuildingMode;
  /** Artwork replacements for the original building, keyed by slot id. */
  slotOverrides?: Record<string, HomepageMediaRef>;
  /** A whole replacement building (single image or looping video). */
  customBuilding?: CanvasElement | null;
  /** The global MATHGPL background soundtrack (plays outside any game). */
  soundtrack?: HomepageMediaRef | null;
  /** Off by default — sound only ever starts because the account asked for it. */
  soundtrackEnabled?: boolean;
  /** 0–1, default 0.4. */
  soundtrackVolume?: number;

}

const STORAGE_KEY = "mathgpl.homepage.config";

/**
 * Every successful Save also files the resulting building into the GPL Assets
 * Buildings shelf as a new snapshot. Loaded lazily so the assets module can
 * import this one without a cycle, and never allowed to fail a Save.
 */
const archiveBuilding = async (version: "pro" | "free", config: HomepageConfig) => {
  try {
    const { snapshotBuilding } = await import("./buildingAssets");
    await snapshotBuilding(version, config);
  } catch (err) {
    console.error("building snapshot failed", err);
  }
};


const readLocal = (): HomepageConfig => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HomepageConfig) : {};
  } catch {
    return {};
  }
};

const writeLocal = (config: HomepageConfig) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* noop */
  }
};

export type HomepageConfigMode = "self" | "school-readonly" | "platform-free";

/** Read the platform-owned Free/advertisement building configuration. */
export async function fetchPlatformFreeBuilding(): Promise<HomepageConfig> {
  const { data } = await supabase.rpc("get_platform_free_building");
  const remote = (data ?? null) as HomepageConfig | null;
  return remote && typeof remote === "object" ? remote : {};
}

/**
 * Local-first homepage config with per-account persistence.
 * Each signed-in account keeps its own homepage; signed-out visitors see defaults.
 *
 * `mode: "school-readonly"` mirrors the academy configured by the owner of the
 * viewer's organization (used by students). It never writes and never caches
 * someone else's theme into this account's local storage.
 *
 * `mode: "platform-free"` is the platform-owned Free/advertisement building.
 * Everyone reads it; only the platform owner can write it (enforced in the
 * database), and it is never cached into this account's local storage.
 */
export function useHomepageConfig(options?: { mode?: HomepageConfigMode }) {
  const mode = options?.mode ?? "self";
  // Start empty so SSR and the first client render agree; local cache is
  // applied after hydration.
  const [config, setConfig] = useState<HomepageConfig>({});
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  // The authoritative copy used when writing. A React state updater runs on the
  // next render, so it must never be the source of the value we persist.
  const configRef = useRef<HomepageConfig>({});
  const apply = useCallback((value: HomepageConfig) => {
    configRef.current = value;
    setConfig(value);
  }, []);


  useEffect(() => {
    let alive = true;
    void (async () => {
      if (mode === "platform-free") {
        const remote = await fetchPlatformFreeBuilding();
        if (!alive) return;
        apply(remote);
        setReady(true);
        return;
      }
      if (mode === "school-readonly") {
        // Prefer the workspace the viewer is currently in; fall back to the
        // organisation that owns them.
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("active_org_id")
          .maybeSingle();
        const activeOrgId = (profileRow as { active_org_id?: string | null } | null)?.active_org_id ?? null;
        const { data } = activeOrgId
          ? await supabase.rpc("get_workspace_homepage_config", { _org_id: activeOrgId })
          : await supabase.rpc("get_org_homepage_config");
        if (!alive) return;
        const remote = (data ?? null) as HomepageConfig | null;
        if (remote && typeof remote === "object") apply(remote);
        setReady(true);
        return;
      }
      const local = readLocal();
      if (alive && Object.keys(local).length > 0) apply(local);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        if (alive) setReady(true);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("homepage_config")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (!alive) return;
      const remote = (data?.homepage_config ?? null) as HomepageConfig | null;
      if (remote && typeof remote === "object") {
        apply(remote);
        writeLocal(remote);
      }
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [mode, apply]);


  /**
   * Merge a patch into the config and PERSIST it. Only the given keys are
   * touched. Errors are thrown so the calling Save button can report them
   * instead of silently pretending the change was stored.
   *
   * The destination is decided by the mode, so a Pro edit can never write the
   * platform Free building and a Free edit can never write the account's own
   * building. `school-readonly` never writes at all.
   */
  const save = useCallback(
    async (patch: Partial<HomepageConfig>) => {
      if (mode === "school-readonly") return;
      setSaving(true);
      const next: HomepageConfig = { ...configRef.current, ...patch };
      apply(next);
      if (mode === "self") writeLocal(next);
      try {
        if (mode === "platform-free") {
          const { error } = await supabase.rpc("set_platform_free_building", { _config: next as never });
          if (error) throw error;
          await archiveBuilding("free", next);
          return;
        }
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Sign in to save your homepage");
        const { error } = await supabase
          .from("profiles")
          .update({ homepage_config: next as never })
          .eq("user_id", userData.user.id);
        if (error) throw error;
        await archiveBuilding("pro", next);
      } finally {
        setSaving(false);
      }

    },
    [mode, apply],
  );



  return { config, save, ready, saving };
}

/**
 * Seed the platform Free building from the acting owner's Pro building.
 *
 * This runs once: the Free building starts as an exact copy of the current Pro
 * configuration (background, all 16 artwork slots, replacement building and its
 * transform), then the two records diverge completely.
 */
export async function ensurePlatformFreeSeeded(): Promise<HomepageConfig> {
  const existing = await fetchPlatformFreeBuilding();
  if (Object.keys(existing).length > 0) return existing;

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return existing;
  const { data } = await supabase
    .from("profiles")
    .select("homepage_config")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  const pro = (data?.homepage_config ?? null) as HomepageConfig | null;
  // A deep copy — no shared mutable object between the two configurations.
  const seed: HomepageConfig = pro && typeof pro === "object" ? JSON.parse(JSON.stringify(pro)) : {};
  await supabase.rpc("set_platform_free_building", { _config: seed as never });
  return seed;
}

// Signed URLs are cached per storage path for the page's lifetime. Without
// this, every resolve minted a NEW url string, which churned scene state.
const signedUrlCache = new Map<string, string>();

/** Resolve a media ref to a displayable URL (signed for private storage). */
export async function resolveMediaUrl(ref?: HomepageMediaRef | null): Promise<string | null> {
  if (!ref?.path) return null;
  if (ref.source === "url") return ref.path;
  const cached = signedUrlCache.get(ref.path);
  if (cached) return cached;
  const url = await getSignedUrl(ref.path);
  if (url) signedUrlCache.set(ref.path, url);
  return url;
}

/** Resolve every slot override to a texture URL usable by the 3D scene. */
export function useResolvedSlotUrls(overrides?: Record<string, HomepageMediaRef>) {
  const key = useMemo(() => JSON.stringify(overrides ?? {}), [overrides]);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    const entries = Object.entries(JSON.parse(key) as Record<string, HomepageMediaRef>);
    if (entries.length === 0) {
      setUrls({});
      return;
    }
    void (async () => {
      const resolved: Record<string, string> = {};
      await Promise.all(
        entries.map(async ([slotId, ref]) => {
          const url = await resolveMediaUrl(ref);
          if (url) resolved[slotId] = url;
        }),
      );
      if (alive) setUrls(resolved);
    })();
    return () => {
      alive = false;
    };
  }, [key]);

  return urls;
}
