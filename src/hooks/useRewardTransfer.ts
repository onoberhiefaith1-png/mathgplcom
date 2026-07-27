// Runtime pipeline: Adventure → Progress Bar full (teacher-defined goal) →
// winner declared → timer frozen → reward lifts out of the scene at the
// Gallery's own animation speed → reward recorded for the winning group →
// Class Gallery opens and plays the saved Start → End animation.
//
// Nothing here recreates a reward: it transfers the reward the teacher already
// configured (placement rows in `class_gallery_rewards`).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadClassGalleryRewards, type ClassGalleryRewardRow } from "@/lib/games/classGalleryRewards";
import { awardClassGalleryReward, loadClassGalleryAwards } from "@/lib/games/classGalleryAwards";
import { classGalleryExists } from "@/lib/games/classGallery";
import type { AdventureBarSummary } from "@/hooks/useAdventureSync";

const FALLBACK_EXIT_MS = 2000;

/**
 * Why a full Progress Bar did not send its reward to the Class Gallery.
 * The reward belongs to the Class Gallery, never to the Adventure — so the
 * only possible misses are "this class has no Gallery" and "this reward has
 * not been linked to that Gallery yet".
 */
export type TransferBlockedReason =
  | "time_expired"
  | "no_gallery"
  | "not_linked"
  | "already_awarded"
  | null;

/** A reward object detected inside the Adventure canvas (kind === "reward"). */
export interface RewardElementRef {
  id: string;
  label?: string | null;
}

/** Live offset applied to a reward that is leaving the Adventure scene. */
export type ExitOffset = { dy: number; opacity: number };


export function useRewardTransfer({
  classId,
  gameId,
  barSummaries,
  barOwner,
  timeExpired,
  galleryPath,
  rewardElements = [],
  enabled = true,
}: {
  classId: string | null | undefined;
  gameId: string | null | undefined;
  barSummaries: AdventureBarSummary[];
  /** progress element id → group id */
  barOwner: Map<string, string>;
  timeExpired: boolean;
  /** e.g. `/student/class/:id/gallery` */
  galleryPath: string;
  /** Reward assets present in this Adventure — auto-detected from the canvas. */
  rewardElements?: RewardElementRef[];
  enabled?: boolean;
}) {
  const navigate = useNavigate();
  const [placements, setPlacements] = useState<ClassGalleryRewardRow[]>([]);
  const [placementsLoaded, setPlacementsLoaded] = useState(false);
  const [galleryPresent, setGalleryPresent] = useState<boolean | null>(null);
  const [alreadyAwarded, setAlreadyAwarded] = useState<Set<string>>(new Set());
  const [departing, setDeparting] = useState<Set<string>>(new Set());
  const [exitOffsets, setExitOffsets] = useState<Map<string, ExitOffset>>(new Map());
  const [transferring, setTransferring] = useState(false);
  const firedRef = useRef(false);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!classId || !gameId) return;
    let cancelled = false;
    (async () => {
      try {
        // Class → Class Gallery → Reward Placement → Award.
        const [hasGallery, rows, awards] = await Promise.all([
          classGalleryExists(classId),
          loadClassGalleryRewards(classId),
          loadClassGalleryAwards(classId),
        ]);
        if (cancelled) return;
        setGalleryPresent(hasGallery);
        setPlacements(rows.filter((r) => r.game_id === gameId));
        setAlreadyAwarded(
          new Set(awards.filter((a) => a.game_id === gameId).map((a) => a.reward_element_id)),
        );
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setPlacementsLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [classId, gameId]);


  useEffect(() => () => { if (frameRef.current != null) cancelAnimationFrame(frameRef.current); }, []);

  /** Rewards of this game that have been transferred already — never re-render them. */
  const transferredIds = useMemo(() => alreadyAwarded, [alreadyAwarded]);

  // A bar is "full" when it reaches the teacher-configured goal for that bar
  // (`required` already encodes the goal percentage) — never a fixed 100%.
  const winnerBar = useMemo(
    () => barSummaries.find((b) => b.required > 0 && b.achieved >= b.required) ?? null,
    [barSummaries],
  );

  const won = !!winnerBar && !timeExpired;
  const winnerGroupId = winnerBar ? barOwner.get(winnerBar.id) ?? null : null;

  /** The goal is met, regardless of whether a transfer is possible. */
  const goalReached = !!winnerBar;
  const pendingTargets = useMemo(
    () => placements.filter((p) => !alreadyAwarded.has(p.reward_element_id)),
    [placements, alreadyAwarded],
  );

  /** Reward assets in this Adventure with no placement in the Class Gallery. */
  const unlinkedRewards = useMemo(() => {
    const linked = new Set(placements.map((p) => p.reward_element_id));
    return rewardElements.filter((el) => !linked.has(el.id) && !alreadyAwarded.has(el.id));
  }, [rewardElements, placements, alreadyAwarded]);

  // Why nothing moved. Only meaningful once the goal is actually reached.
  const blockedReason: TransferBlockedReason = useMemo(() => {
    if (!goalReached || transferring) return null;
    if (timeExpired) return "time_expired";
    if (!placementsLoaded) return null;
    if (galleryPresent === false) return "no_gallery";
    if (pendingTargets.length > 0) return null; // a transfer is about to run
    if (unlinkedRewards.length > 0) return "not_linked";
    if (alreadyAwarded.size > 0) return "already_awarded";
    return "not_linked";
  }, [
    goalReached,
    transferring,
    timeExpired,
    placementsLoaded,
    galleryPresent,
    pendingTargets.length,
    unlinkedRewards.length,
    alreadyAwarded.size,
  ]);



  const run = useCallback(
    async (barId: string) => {
      if (!classId || !gameId) return;
      const groupId = barOwner.get(barId) ?? null;
      const targets = placements.filter((p) => !transferredIds.has(p.reward_element_id));
      if (targets.length === 0) return;

      setTransferring(true);
      const ids = targets.map((t) => t.reward_element_id);
      setDeparting(new Set(ids));

      // The Adventure scene never owns a speed of its own: the exit uses the
      // same duration the teacher configured for this reward in the Gallery.
      const exitMs = Math.max(
        500,
        Number(targets[0]?.duration_ms) || FALLBACK_EXIT_MS,
      );

      await new Promise<void>((resolve) => {
        const t0 = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - t0) / exitMs);
          // Ease-in: slow lift, then accelerates off the top of the scene.
          const k = t * t;
          const next = new Map<string, ExitOffset>();
          for (const id of ids) next.set(id, { dy: -1.4 * k, opacity: Math.max(0, 1 - t * t) });
          setExitOffsets(next);
          if (t < 1) {
            frameRef.current = requestAnimationFrame(step);
          } else {
            frameRef.current = null;
            resolve();
          }
        };
        frameRef.current = requestAnimationFrame(step);
      });

      try {
        for (const t of targets) {
          await awardClassGalleryReward({
            class_id: classId,
            game_id: gameId,
            reward_element_id: t.reward_element_id,
            group_id: groupId,
          });
        }
      } catch (e) {
        console.error(e);
      }

      const first = targets[0];
      const params = new URLSearchParams({
        animateReward: `${gameId}:${first.reward_element_id}`,
      });
      if (groupId) params.set("group", groupId);
      navigate(`${galleryPath}?${params.toString()}`);
    },
    [classId, gameId, barOwner, placements, transferredIds, galleryPath, navigate],
  );

  useEffect(() => {
    if (!enabled || firedRef.current) return;
    if (timeExpired) return; // Part 7 — time beat every group, no transfer.
    if (!winnerBar) return;
    // Only latch once a transfer can genuinely start: if placements arrive
    // late (or a reward is linked after the goal was met) this can still fire.
    if (!placementsLoaded || pendingTargets.length === 0) return;
    firedRef.current = true;
    void run(winnerBar.id);
  }, [enabled, timeExpired, winnerBar, placementsLoaded, pendingTargets.length, run]);

  return {
    /** Reward element ids currently lifting away from the scene. */
    departing,
    /** Live per-reward offset while it exits (continuous, Gallery speed). */
    exitOffsets,
    /** Reward element ids that already live in the Gallery — hide in the game. */
    transferredIds,
    transferring,
    /** True as soon as a bar reaches its configured goal — freeze the game. */
    won,
    /** Goal met, even if the transfer is blocked (e.g. time already expired). */
    goalReached,
    /** Why a met goal did not move a reward — drives the on-screen message. */
    blockedReason,
    winnerGroupId,
    winnerBarId: winnerBar?.id ?? null,
  };

}
