// Platform advertisements: 8 slots that play on the rotating building's
// billboard. Managed by the platform owner only — owning a building never
// grants advertisement access.
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MediaSource, MediaType } from "@/lib/games/types";

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
 * Rotation state for the billboard.
 *
 * Image ads hold for their duration while the building keeps turning. A video
 * ad pauses the building until the video has played to the end, then the
 * building resumes and moves on to the next advertisement.
 */
export function useAdRotation(ads: AdvertisementRow[]) {
  const [index, setIndex] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  const current = ads.length > 0 ? ads[index % ads.length] : null;
  const isVideo = current?.media_type === "video";

  const next = useCallback(() => {
    setIndex((i) => (ads.length === 0 ? 0 : (i + 1) % ads.length));
  }, [ads.length]);

  useEffect(() => {
    if (index !== 0 && index >= ads.length) setIndex(0);
  }, [ads.length, index]);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (!current || isVideo) return;
    timer.current = window.setTimeout(next, Math.max(1500, current.duration_ms || 6000));
    return () => window.clearTimeout(timer.current);
  }, [current, isVideo, next]);

  return {
    current,
    /** True while a video advertisement is on screen — the building holds still. */
    rotationPaused: Boolean(current) && isVideo,
    onVideoEnded: next,
  };
}
