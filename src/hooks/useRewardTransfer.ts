// Runtime pipeline: Adventure → Progress Bar complete → reward leaves the
// scene → reward is recorded for the winning group → Class Gallery opens and
// plays the saved Start → End animation.
//
// Nothing here recreates a reward: it transfers the reward the teacher already
// configured (placement rows in `class_gallery_rewards`).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadClassGalleryRewards, type ClassGalleryRewardRow } from "@/lib/games/classGalleryRewards";
import { awardClassGalleryReward, loadClassGalleryAwards } from "@/lib/games/classGalleryAwards";
import type { AdventureBarSummary } from "@/hooks/useAdventureSync";

const EXIT_MS = 1400;

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
  const [transferring, setTransferring] = useState(false);
  const firedRef = useRef(false);

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

  /** Rewards of this game that have been transferred already — never re-render them. */
  const transferredIds = useMemo(() => alreadyAwarded, [alreadyAwarded]);

  const winnerBar = useMemo(
    () => barSummaries.find((b) => b.required > 0 && b.achieved >= b.required) ?? null,
    [barSummaries],
  );

  const run = useCallback(
    async (barId: string) => {
      if (!classId || !gameId) return;
      const groupId = barOwner.get(barId) ?? null;
      const targets = placements.filter((p) => !transferredIds.has(p.reward_element_id));
      if (targets.length === 0) return;

      setTransferring(true);
      setDeparting(new Set(targets.map((t) => t.reward_element_id)));

      await new Promise((r) => setTimeout(r, EXIT_MS));

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
    /** Reward element ids that already live in the Gallery — hide in the game. */
    transferredIds,
    transferring,
    winnerBarId: winnerBar?.id ?? null,
  };
}
