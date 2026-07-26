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
import type { AdventureBarSummary } from "@/hooks/useAdventureSync";

const FALLBACK_EXIT_MS = 2000;

/** Live offset applied to a reward that is leaving the Adventure scene. */
export type ExitOffset = { dy: number; opacity: number };

export function useRewardTransfer({
  classId,
  gameId,
  barSummaries,
  barOwner,
  timeExpired,
  galleryPath,
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
  enabled?: boolean;
}) {
  const navigate = useNavigate();
  const [placements, setPlacements] = useState<ClassGalleryRewardRow[]>([]);
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
        const [rows, awards] = await Promise.all([
          loadClassGalleryRewards(classId),
          loadClassGalleryAwards(classId),
        ]);
        if (cancelled) return;
        setPlacements(rows.filter((r) => r.game_id === gameId));
        setAlreadyAwarded(
          new Set(awards.filter((a) => a.game_id === gameId).map((a) => a.reward_element_id)),
        );
      } catch (e) {
        console.error(e);
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
    if (placements.length === 0) return;
    firedRef.current = true;
    void run(winnerBar.id);
  }, [enabled, timeExpired, winnerBar, placements.length, run]);

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
    winnerGroupId,
    winnerBarId: winnerBar?.id ?? null,
  };
}
