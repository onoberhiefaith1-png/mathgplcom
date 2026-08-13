// Platform advertisements: 8 slots that play on the rotating building's
// billboard. Managed by the platform owner only — owning a building never
// grants advertisement access.
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MediaSource, MediaType } from "@/lib/games/types";
import { resolveMediaUrl } from "./homepageConfig";

export const AD_SLOT_COUNT = 8;
export const AD_SLOTS = Array.from({ length: AD_SLOT_COUNT }, (_, i) => i + 1);

export interface AdvertisementRow {
  id: string;
  slot: number;
  media_path: string | null;
  media_source: MediaSource;
  media_type: MediaType;
  label: string | null;
  is_active: boolean;
  duration_ms: number;
}

const SELECT = "id, slot, media_path, media_source, media_type, label, is_active, duration_ms";

export async function fetchAdvertisements(): Promise<AdvertisementRow[]> {
  const { data } = await supabase
    .from("platform_advertisements")
    .select(SELECT)
    .order("slot", { ascending: true });
  return ((data ?? []) as unknown as AdvertisementRow[]).map((row) => ({
    ...row,
    media_source: (row.media_source ?? "storage") as MediaSource,
    media_type: (row.media_type ?? "image") as MediaType,
  }));
}

/** Every configured slot, for the admin editor. */
export function useAdvertisements() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["platform-advertisements"], queryFn: fetchAdvertisements });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["platform-advertisements"] });

  const upsert = useMutation({
    mutationFn: async (input: {
      slot: number;
      media_path: string | null;
      media_source: MediaSource;
      media_type: MediaType;
      label?: string | null;
      is_active?: boolean;
      duration_ms?: number;
    }) => {
      const { error } = await supabase
        .from("platform_advertisements")
        .upsert(
          {
            slot: input.slot,
            media_path: input.media_path,
            media_source: input.media_source,
            media_type: input.media_type,
            label: input.label ?? null,
            is_active: input.is_active ?? true,
            duration_ms: input.duration_ms ?? 6000,
          } as never,
          { onConflict: "slot" },
        );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const patch = useMutation({
    mutationFn: async (input: { slot: number; is_active?: boolean; duration_ms?: number; label?: string | null }) => {
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
  return (query.data ?? []).filter((ad) => ad.is_active && ad.media_path);
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
 * Rotation state driven by the building itself.
 *
 * The advertisement shown is the one belonging to the outer position currently
 * facing the camera. An image advertisement simply sits in the billboard while
 * the building keeps turning. A video advertisement holds the building still,
 * plays from the beginning to the end, and only then lets the building resume
 * and turn to the next advertisement. Empty or disabled slots show nothing and
 * never interrupt the rotation.
 */
export function useFacingAdRotation(ads: AdvertisementRow[]) {
  const [facing, setFacing] = useState(0);
  const [playedSlot, setPlayedSlot] = useState<number | null>(null);

  const current = adForOuterPosition(ads, facing);
  const isVideo = current?.media_type === "video";

  const onFacingChange = useCallback((index: number) => {
    setFacing(index);
    setPlayedSlot((played) => {
      const ad = ads.find((a) => a.slot === index + 1);
      // A different face arrived → the previous video may play again next time.
      return ad && played === ad.slot ? played : null;
    });
  }, [ads]);

  const onVideoEnded = useCallback(() => {
    if (current) setPlayedSlot(current.slot);
  }, [current]);

  const holdingForVideo = Boolean(isVideo && current && playedSlot !== current.slot);

  return {
    current,
    /** True while a video advertisement plays — the building holds still. */
    rotationPaused: holdingForVideo,
    onVideoEnded,
    onFacingChange,
  };
}

