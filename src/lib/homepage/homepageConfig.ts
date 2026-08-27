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
  /**
   * How fast the building moves: video playback rate for a custom building,
   * rotation rate for the MathGPL building. 0.1 – 10, default 1 (normal).
   */
  buildingSpeed?: number;

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

/** Speed is always read through here: 1 = normal, clamped to the 0.1–10 range. */
export const BUILDING_SPEED_MIN = 0.1;
export const BUILDING_SPEED_MAX = 10;
export const clampBuildingSpeed = (value: number | undefined | null) => {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 1;
  return Math.min(BUILDING_SPEED_MAX, Math.max(BUILDING_SPEED_MIN, n));
};

/** Slider position (0–1) ⇄ speed, with 1× sitting exactly in the middle. */
export const speedToSlider = (speed: number) => {
  const s = clampBuildingSpeed(speed);
  return s <= 1
    ? ((s - BUILDING_SPEED_MIN) / (1 - BUILDING_SPEED_MIN)) * 0.5
    : 0.5 + ((s - 1) / (BUILDING_SPEED_MAX - 1)) * 0.5;
};
export const sliderToSpeed = (pos: number) => {
  const p = Math.min(1, Math.max(0, pos));
  const raw =
    p <= 0.5
      ? BUILDING_SPEED_MIN + (p / 0.5) * (1 - BUILDING_SPEED_MIN)
      : 1 + ((p - 0.5) / 0.5) * (BUILDING_SPEED_MAX - 1);
  return Math.round(raw * 100) / 100;
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
export function useHomepageConfig(options?: { mode?: HomepageConfigMode; ownerUserId?: string }) {
  const mode = options?.mode ?? "self";
  const ownerUserId = options?.ownerUserId;
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
      try {
      // A named account's own building: a student entering a school's or a
      // teacher's workspace sees that owner's building, never their own.
      if (ownerUserId) {
        const { data } = await supabase.rpc("get_account_homepage_config", { _user_id: ownerUserId });
        if (!alive) return;
        const remote = (data ?? null) as HomepageConfig | null;
        if (remote && typeof remote === "object") apply(remote);
        return;
      }
      if (mode === "platform-free") {
        const remote = await fetchPlatformFreeBuilding();
        if (!alive) return;
        apply(remote);
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
        return;
      }
      const local = readLocal();
      if (alive && Object.keys(local).length > 0) apply(local);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
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
      } catch (error) {
        console.error("homepage configuration failed; using shipped defaults", error);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode, ownerUserId, apply]);


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

/** Resolve a media ref to a displayable URL (signed for private storage). */
export async function resolveMediaUrl(ref?: HomepageMediaRef | null): Promise<string | null> {
  if (!ref?.path) return null;
  if (ref.source === "url") return ref.path;
  // getSignedUrl owns the TTL-aware cache. A second permanent cache here used
  // to keep expired one-hour URLs alive for the whole tab session.
  return getSignedUrl(ref.path);
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
