// Per-account Homepage look: background layer + building layer.
// The two layers are stored independently and never overwrite each other.
import { useCallback, useEffect, useMemo, useState } from "react";
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
}

const STORAGE_KEY = "mathgpl.homepage.config";

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

/**
 * Local-first homepage config with per-account persistence.
 * Each signed-in account keeps its own homepage; signed-out visitors see defaults.
 */
export function useHomepageConfig() {
  const [config, setConfig] = useState<HomepageConfig>(() => readLocal());
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
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
        setConfig(remote);
        writeLocal(remote);
      }
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  /** Merge a patch into the config. Only the given keys are touched. */
  const save = useCallback(async (patch: Partial<HomepageConfig>) => {
    setSaving(true);
    let next: HomepageConfig = {};
    setConfig((prev) => {
      next = { ...prev, ...patch };
      writeLocal(next);
      return next;
    });
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase
          .from("profiles")
          .update({ homepage_config: next as never })
          .eq("user_id", userData.user.id);
      }
    } finally {
      setSaving(false);
    }
  }, []);

  return { config, save, ready, saving };
}

/** Resolve a media ref to a displayable URL (signed for private storage). */
export async function resolveMediaUrl(ref?: HomepageMediaRef | null): Promise<string | null> {
  if (!ref?.path) return null;
  if (ref.source === "url") return ref.path;
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
