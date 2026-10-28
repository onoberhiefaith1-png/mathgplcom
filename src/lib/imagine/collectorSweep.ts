import { isWorldInteractionEligible } from "@/lib/slate/rewards";
import type { RewardInstance } from "@/lib/slate/types";

export type ImagineCollectorAxis = "x" | "y";

export interface ImagineScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface ImagineSweepTarget {
  slotId: string;
  reward: RewardInstance;
  rect: ImagineScreenRect | null;
}

export interface ImagineSweepResult extends ImagineSweepTarget {
  distance: number;
}

export const imagineCollectorAxis = (type: string): ImagineCollectorAxis | null => {
  if (type === "horizontal-collector") return "x";
  if (type === "vertical-collector") return "y";
  return null;
};

const centre = (rect: ImagineScreenRect, axis: ImagineCollectorAxis): number =>
  axis === "x" ? rect.left + rect.width / 2 : rect.top + rect.height / 2;

/**
 * Imagine's collectors mirror the Game with screen geometry: Horizontal
 * crosses one row, Vertical crosses one column, and rewards are returned in
 * the exact order in which the moving collector reaches them.
 */
export function imagineCollectorTargets(
  sourceRewardId: string,
  axis: ImagineCollectorAxis,
  direction: 1 | -1,
  sourceRect: ImagineScreenRect,
  targets: readonly ImagineSweepTarget[],
  visited: ReadonlySet<string>,
): ImagineSweepResult[] {
  const sourceAlong = centre(sourceRect, axis);
  const sourceAcross = centre(sourceRect, axis === "x" ? "y" : "x");
  const sourceBreadth = axis === "x" ? sourceRect.height : sourceRect.width;

  return targets
    .flatMap((target): ImagineSweepResult[] => {
      const { reward, rect } = target;
      if (!rect
        || reward.id === sourceRewardId
        || visited.has(reward.id)
        || reward.hidden
        || reward.state !== "dormant"
        || !isWorldInteractionEligible(reward.type)) return [];

      const targetAlong = centre(rect, axis);
      const targetAcross = centre(rect, axis === "x" ? "y" : "x");
      const targetBreadth = axis === "x" ? rect.height : rect.width;
      const inFront = direction > 0 ? targetAlong > sourceAlong : targetAlong < sourceAlong;
      const inBand = Math.abs(targetAcross - sourceAcross) <= Math.max(sourceBreadth, targetBreadth) * 0.8;
      if (!inFront || !inBand) return [];
      return [{ ...target, distance: Math.abs(targetAlong - sourceAlong) }];
    })
    .sort((a, b) => a.distance - b.distance);
}