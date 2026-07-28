// Builds the "earned rewards" layer for a class Gallery.
//
// The Gallery canvas itself (background, effects, layout) is shared by every
// group. Only the awarded rewards differ, so this hook joins the saved
// placements (`class_gallery_rewards`) with the earned records
// (`class_gallery_awards`) filtered by group, and returns ready-to-render
// canvas elements pinned at their saved End Position.
//
// When `animate` names a reward that has just been won, that reward travels
// from its saved Start Position to its End Position once, then stays there.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { loadClassGalleryRewards, type ClassGalleryRewardRow } from "@/lib/games/classGalleryRewards";
import { loadClassGalleryAwards, type ClassGalleryAwardRow } from "@/lib/games/classGalleryAwards";
import type { CanvasElement } from "@/lib/games/types";

export const AWARD_PREFIX = "award-";

export type AnimateTarget = { gameId: string; elementId: string } | null;

const keyOf = (gameId: string, elementId: string) => `${gameId}:${elementId}`;

/** Parse the `?animateReward=gameId:elementId` query value. */
export const parseAnimateReward = (raw: string | null): AnimateTarget => {
  if (!raw) return null;
  const [gameId, elementId] = raw.split(":");
  return gameId && elementId ? { gameId, elementId } : null;
};

export function useGalleryAwards({
  classId,
  groupId,
  animate,
  onAnimationEnd,
}: {
  classId: string | null | undefined;
  /** null = Whole Class bucket. */
  groupId: string | null;
  animate?: AnimateTarget;
  onAnimationEnd?: () => void;
}) {
  const [placements, setPlacements] = useState<ClassGalleryRewardRow[]>([]);
  const [awards, setAwards] = useState<ClassGalleryAwardRow[]>([]);
  const [flightPos, setFlightPos] = useState<{ x: number; y: number } | null>(null);
  const [flying, setFlying] = useState(false);
  const frameRef = useRef<number | null>(null);
  const playedRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!classId) { setPlacements([]); setAwards([]); return; }
    try {
      const [p, a] = await Promise.all([
        loadClassGalleryRewards(classId),
        loadClassGalleryAwards(classId),
      ]);
      setPlacements(p);
      setAwards(a);
    } catch (e) {
      console.error(e);
    }
  }, [classId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Live: a reward won by anyone in the class appears immediately.
  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`class-gallery-awards-${classId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "class_gallery_awards", filter: `class_id=eq.${classId}` },
          () => { void refresh(); },
        )
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [classId, refresh]);

  const placementByKey = useMemo(() => {
    const m = new Map<string, ClassGalleryRewardRow>();
    for (const p of placements) m.set(keyOf(p.game_id, p.reward_element_id), p);
    return m;
  }, [placements]);

  const visibleAwards = useMemo(
    () => awards.filter((a) => (a.group_id ?? null) === (groupId ?? null)),
    [awards, groupId],
  );

  const animateKey = animate ? keyOf(animate.gameId, animate.elementId) : null;
  const animatedPlacement = animateKey ? placementByKey.get(animateKey) ?? null : null;

  // Run the Start → End flight once for a freshly-won reward.
  useEffect(() => {
    if (!animateKey || !animatedPlacement) return;
    if (playedRef.current === animateKey) return;
    playedRef.current = animateKey;

    const p = animatedPlacement;
    const dur = Math.max(500, Number(p.duration_ms) || 2000);
    setFlying(true);
    setSettleT(0);
    setFlightPos({ x: Number(p.start_x), y: Number(p.start_y) });
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setFlightPos({
        x: Number(p.start_x) + (Number(p.end_x) - Number(p.start_x)) * k,
        y: Number(p.start_y) + (Number(p.end_y) - Number(p.start_y)) * k,
      });
      if (t < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        frameRef.current = null;
        setFlightPos({ x: Number(p.end_x), y: Number(p.end_y) });
        setFlying(false);
        // Only now, at the End Position, does the reward adopt the Gallery's
        // saved transform — a short settle, never a jump mid-flight.
        const s0 = performance.now();
        const settle = (n: number) => {
          const s = Math.min(1, (n - s0) / SETTLE_MS);
          setSettleT(s < 1 ? 1 - Math.pow(1 - s, 3) : 1);
          if (s < 1) {
            frameRef.current = requestAnimationFrame(settle);
          } else {
            frameRef.current = null;
            onAnimationEnd?.();
          }
        };
        frameRef.current = requestAnimationFrame(settle);
      }
    };
    frameRef.current = requestAnimationFrame(step);
    return () => { if (frameRef.current != null) cancelAnimationFrame(frameRef.current); };
  }, [animateKey, animatedPlacement, onAnimationEnd]);

  const elements = useMemo<CanvasElement[]>(() => {
    const out: CanvasElement[] = [];
    visibleAwards.forEach((a, i) => {
      const p = placementByKey.get(keyOf(a.game_id, a.reward_element_id));
      if (!p) return;
      const isFlight = animateKey === keyOf(a.game_id, a.reward_element_id) && flightPos;
      // The configured Adventure instance, when one was captured. Legacy rows
      // fall back to the raw placement fields exactly as before.
      const style = (p.element_style ?? null) as RewardElementStyle | null;
      // Adventure look holds for the whole journey; Gallery values take over
      // as the reward settles at its End Position (t = 1 = fully Gallery).
      const t = isFlight ? (style ? settleT : 1) : 1;
      const mix = (from: number, to: number) => from + (to - from) * t;
      const fromScale = style ? Number(style.scale) : Number(p.scale);
      const fromRot = style ? Number(style.rotation) : Number(p.rotation);
      const fromOpacity = style ? Number(style.opacity) : Number(p.opacity);

      out.push({
        id: `${AWARD_PREFIX}${a.id}`,
        kind: "reward",
        assetId: p.asset_id ?? "",
        mediaType: style?.mediaType ?? p.media_type,
        storagePath: style?.storagePath ?? p.storage_path,
        source: style?.source ?? p.source,
        x: isFlight ? flightPos!.x : Number(p.end_x),
        y: isFlight ? flightPos!.y : Number(p.end_y),
        scale: mix(fromScale, Number(p.scale)),
        z: 800 + i,
        rotation: mix(fromRot, Number(p.rotation)),
        opacity: mix(fromOpacity, Number(p.opacity)),
        animation: { type: "none", amplitude: 0, speed: 1, loop: false },
        // Transparency and compositing never reset to the raw upload.
        blend: style?.blend ?? "normal",
        bgRemoval: style?.bgRemoval ?? "none",
        keyColor: style?.keyColor,
        keyTolerance: style?.keyTolerance,
        tint: style?.tint,
        slant: style?.slant,
        label: style?.label || "Reward",
      });
    });
    return out;
  }, [visibleAwards, placementByKey, animateKey, flightPos, settleT]);


  /** Vertical position (0..1) of the flying reward, for camera follow. */
  const flightY = flightPos?.y ?? null;

  return { elements, awards, placements, flying, flightY, refresh };
}
