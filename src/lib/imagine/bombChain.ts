import type { RewardInstance } from "@/lib/slate/types";

export interface ImagineRewardTarget {
  slotId: string;
  reward: RewardInstance;
  visible: boolean;
}

export const IMAGINE_ENERGY_BALL_TYPES = new Set(["imagine-energy-ball"]);

export const isImagineEnergyBall = (type: string): boolean => IMAGINE_ENERGY_BALL_TYPES.has(type);

/**
 * The Energy Ball answers to a WIDER rule than bombs and collectors: its
 * projectiles activate every eligible reward on screen — including the Vault —
 * and only the Hourglass (time-shard) and the Completion coin (mark-seal) are
 * never activated. Both still answer only to the student's own mathematics.
 */
export const isEnergyBallTargetEligible = (type: string): boolean =>
  type !== "time-shard" && type !== "mark-seal";

/**
 * Deterministic Energy Ball targets: rendered slot/reward order, never random.
 * Same skip rules as the bomb chain (source, visited, hidden, consumed/active,
 * off-screen), but with the Energy Ball's own eligibility rule above.
 */
export function imagineEnergyBallTargets(
  sourceRewardId: string,
  rewards: readonly ImagineRewardTarget[],
  visited: ReadonlySet<string>,
): ImagineRewardTarget[] {
  return rewards.filter(({ reward, visible }) =>
    visible
    && reward.id !== sourceRewardId
    && !visited.has(reward.id)
    && !reward.hidden
    && reward.state === "dormant"
    && isEnergyBallTargetEligible(reward.type),
  );
}