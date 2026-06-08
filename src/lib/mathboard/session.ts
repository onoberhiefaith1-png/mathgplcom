import { Node } from "./tokens";

export type SessionStatus = "question" | "editing" | "valid" | "invalid" | "pending";

export type RewardKind = "coin" | "diamond" | "crown" | "heart";

export interface RewardSlot {
  kind: RewardKind;
  unlocked: boolean;
}

export interface Session {
  id: string;
  index: number;
  nodes: Node[];
  status: SessionStatus;
  rewards: RewardSlot[];
}

let _sid = 0;
export const sid = () => `s${++_sid}_${Math.random().toString(36).slice(2, 6)}`;

/**
 * 80% coin / 20% objective distribution.
 * Each session displays a 5-slot strip: 4 coins + 1 objective item.
 * The objective slot cycles deterministically diamond → heart → crown.
 */
export const defaultRewards = (idx: number): RewardSlot[] => {
  const objectiveCycle: RewardKind[] = ["diamond", "heart", "crown"];
  const objective = objectiveCycle[(idx - 1 + objectiveCycle.length) % objectiveCycle.length];
  const slots: RewardSlot[] = [
    { kind: "coin", unlocked: false },
    { kind: "coin", unlocked: false },
    { kind: "coin", unlocked: false },
    { kind: "coin", unlocked: false },
    { kind: objective, unlocked: false },
  ];
  return slots;
};

export const newSession = (index: number, status: SessionStatus = "editing"): Session => ({
  id: sid(),
  index,
  nodes: [],
  status,
  rewards: defaultRewards(index),
});
