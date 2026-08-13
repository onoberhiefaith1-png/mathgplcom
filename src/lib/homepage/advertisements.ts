// Platform advertisements: 8 slots that play on the rotating building's
// billboard. Managed by the platform owner only — owning a building never
// grants advertisement access.
//
// ARCHITECTURE
//
//   external provider (Google, other)        manual upload
//                        \                    /
//                     provider adapter (resolveCreative)
//                                 |
//                        8 platform slots
//                                 |
//                   rotating building billboard
//
// The building never learns where a creative came from. It receives a
// normalised `AdCreative` and renders it inside the billboard.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MediaSource, MediaType } from "@/lib/games/types";
import { resolveMediaUrl } from "./homepageConfig";

export const AD_SLOT_COUNT = 8;
export const AD_SLOTS = Array.from({ length: AD_SLOT_COUNT }, (_, i) => i + 1);

/** Where a creative comes from. Only `manual` renders today. */
export type AdProvider = "manual" | "google" | "other";
export const AD_PROVIDERS: AdProvider[] = ["manual", "google", "other"];

export const AD_PROVIDER_LABEL: Record<AdProvider, string> = {
  manual: "Manual upload",
  google: "Google advertising",
  other: "Other provider",
};

export interface AdvertisementRow {
  id: string;
  slot: number;
  media_path: string | null;
  media_source: MediaSource;
  media_type: MediaType;
  label: string | null;
  is_active: boolean;
  duration_ms: number;
  provider: AdProvider;
  provider_ad_id: string | null;
  campaign_name: string | null;
  thumbnail_path: string | null;
  click_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
}

/** What the building renders. Provider-agnostic by design. */
export interface AdCreative {
  slot: number;
  provider: AdProvider;
  mediaType: MediaType;
  mediaPath: string;
  mediaSource: MediaSource;
  /** How long an image advertisement holds the facing position. */
  durationMs: number;
  clickUrl: string | null;
}

const SELECT =
  "id, slot, media_path, media_source, media_type, label, is_active, duration_ms, provider, provider_ad_id, campaign_name, thumbnail_path, click_url, starts_at, ends_at";

export async function fetchAdvertisements(): Promise<AdvertisementRow[]> {
  const { data } = await supabase
    .from("platform_advertisements")
    .select(SELECT)
    .order("slot", { ascending: true });
  return ((data ?? []) as unknown as AdvertisementRow[]).map((row) => ({
    ...row,
    media_source: (row.media_source ?? "storage") as MediaSource,
    media_type: (row.media_type ?? "image") as MediaType,
    provider: (row.provider ?? "manual") as AdProvider,
  }));
}

/** Inside its scheduled window (an empty window means always). */
export function isScheduled(ad: AdvertisementRow, now = Date.now()): boolean {
  if (ad.starts_at && new Date(ad.starts_at).getTime() > now) return false;
  if (ad.ends_at && new Date(ad.ends_at).getTime() < now) return false;
  return true;
}

/**
 * PROVIDER ADAPTER
 *
 * Turns a stored slot row into a creative the building can play, or null when
 * the slot has nothing renderable (empty, disabled, out of schedule, or an
 * external provider whose integration is not connected yet).
 */
export function resolveCreative(ad: AdvertisementRow, now = Date.now()): AdCreative | null {
  if (!ad.is_active || !isScheduled(ad, now)) return null;
  // Google/other creatives are stored and previewed, but only render once their
  // adapter supplies compatible media for the 3D billboard.
  if (!ad.media_path) return null;
  return {
    slot: ad.slot,
    provider: ad.provider,
    mediaType: ad.media_type,
    mediaPath: ad.media_path,
    mediaSource: ad.media_source,
    durationMs: Math.max(2000, ad.duration_ms || 6000),
    clickUrl: ad.click_url,
  };
}

export interface AdvertisementInput {
  slot: number;
  media_path?: string | null;
  media_source?: MediaSource;
  media_type?: MediaType;
  label?: string | null;
  is_active?: boolean;
  duration_ms?: number;
  provider?: AdProvider;
  provider_ad_id?: string | null;
  campaign_name?: string | null;
  thumbnail_path?: string | null;
  click_url?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
}

/** Every configured slot, for the admin editor. */
export function useAdvertisements() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["platform-advertisements"], queryFn: fetchAdvertisements });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["platform-advertisements"] });

  const upsert = useMutation({
    mutationFn: async (input: AdvertisementInput) => {
      const { error } = await supabase
        .from("platform_advertisements")
        .upsert(
          {
            slot: input.slot,
            media_path: input.media_path ?? null,
            media_source: input.media_source ?? "storage",
            media_type: input.media_type ?? "image",
            label: input.label ?? null,
            is_active: input.is_active ?? true,
            duration_ms: input.duration_ms ?? 6000,
            provider: input.provider ?? "manual",
            provider_ad_id: input.provider_ad_id ?? null,
            campaign_name: input.campaign_name ?? null,
            thumbnail_path: input.thumbnail_path ?? null,
            click_url: input.click_url ?? null,
            starts_at: input.starts_at ?? null,
            ends_at: input.ends_at ?? null,
          } as never,
          { onConflict: "slot" },
        );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const patch = useMutation({
    mutationFn: async (input: AdvertisementInput) => {
      const { slot, ...rest } = input;
      const { error } = await supabase
        .from("platform_advertisements")
        .update(rest as never)
        .eq("slot", slot);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (slot: number) => {
      const { error } = await supabase.from("platform_advertisements").delete().eq("slot", slot);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { ads: query.data ?? [], isLoading: query.isLoading, upsert, patch, remove };
}

/** Only the playable ads, in slot order. Empty slots are simply skipped. */
export function usePlayableAds(enabled: boolean) {
  const query = useQuery({
    queryKey: ["platform-advertisements", "playable"],
    queryFn: fetchAdvertisements,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
  const rows = query.data ?? [];
  return useMemo(
    () => rows.filter((ad) => resolveCreative(ad) !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows.map((r) => `${r.slot}:${r.media_path}:${r.is_active}:${r.starts_at}:${r.ends_at}`).join("|")],
  );
}

/**
 * Advertisement slot 1–8 map one-to-one onto the building's 8 outer positions.
 * Slot 1 → outer position 1, slot 2 → outer position 2, and so on.
 */
export function adForOuterPosition(ads: AdvertisementRow[], position: number) {
  return ads.find((ad) => ad.slot === position + 1) ?? null;
}

/** Signed media URLs for image advertisements, keyed by outer position index. */
export function useAdImageUrls(ads: AdvertisementRow[]) {
  const [urls, setUrls] = useState<Record<number, string>>({});
  const key = ads
    .filter((ad) => ad.media_type === "image")
    .map((ad) => `${ad.slot}:${ad.media_path}:${ad.media_source}`)
    .join("|");

  useEffect(() => {
    let alive = true;
    const images = ads.filter((ad) => ad.media_type === "image" && ad.media_path);
    if (images.length === 0) {
      setUrls({});
      return;
    }
    void (async () => {
      const resolved: Record<number, string> = {};
      await Promise.all(
        images.map(async (ad) => {
          const url = await resolveMediaUrl({ path: ad.media_path!, source: ad.media_source, mediaType: "image" });
          if (url) resolved[ad.slot - 1] = url;
        }),
      );
      if (alive) setUrls(resolved);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}

/**
 * ROTATION CONTROLLER
 *
 * The advertisement shown is the one belonging to the outer position currently
 * facing the camera.
 *
 *   image → the building holds for the configured display duration, then resumes
 *   video → the building holds still until the video has played to the very end
 *   empty / disabled / out of schedule → nothing shows, rotation never stops
 */
export function useFacingAdRotation(ads: AdvertisementRow[]) {
  const [facing, setFacing] = useState(0);
  /** Slots whose current visit has already been served. */
  const [servedSlot, setServedSlot] = useState<number | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const currentRow = adForOuterPosition(ads, facing);
  const current = currentRow ? resolveCreative(currentRow) : null;
  const isVideo = current?.mediaType === "video";
  const served = current ? servedSlot === current.slot : true;

  const onFacingChange = useCallback((index: number) => {
    setFacing((prev) => (prev === index ? prev : index));
    setServedSlot((prevServed) => (prevServed === index + 1 ? prevServed : null));
  }, []);

  const onVideoEnded = useCallback(() => {
    if (current) setServedSlot(current.slot);
  }, [current]);

  // An image advertisement holds the facing position for its display duration.
  useEffect(() => {
    window.clearTimeout(timerRef.current);
    if (!current || isVideo || served) return;
    const slot = current.slot;
    timerRef.current = window.setTimeout(() => setServedSlot(slot), current.durationMs);
    return () => window.clearTimeout(timerRef.current);
  }, [current, isVideo, served]);

  const holding = Boolean(current && !served);

  return {
    current,
    /** True while an advertisement is on screen — the building holds still. */
    rotationPaused: holding,
    onVideoEnded,
    onFacingChange,
  };
}
