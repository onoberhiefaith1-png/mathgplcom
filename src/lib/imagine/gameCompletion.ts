import type { GameCompletionFlow, GameCompletionMoment } from "@/lib/slate/types";

export type CompletionOutcome = GameCompletionMoment;

export interface QuestionRewardSummary {
  marks: number;
  totalMarks: number;
  completionCoins: number;
  vaultReward: number;
  vaultsOpened: number;
  timeEarnedSeconds: number;
  livesDelta: number;
}

export const defaultGameCompletionFlow = (): GameCompletionFlow => ({
  enabled: false,
  clips: [],
  baseScene: null,
  moments: {
    complete: null,
    perfect: null,
    victory: null,
    failed: null,
    left: null,
  },
  emojiKeys: true,
  position: {
    x: 76,
    y: 56,
    scale: 1,
    volume: 0.75,
    emotionBar: { x: 0.17, y: 0.74, scale: 1 },
  },
});

export function completionOutcome(input: {
  failed?: boolean;
  left?: boolean;
  final?: boolean;
  marks: number;
  totalMarks: number;
  availableRewards: number;
  collectedRewards: number;
}): CompletionOutcome {
  if (input.left) return "left";
  if (input.failed) return "failed";
  if (input.final) return "victory";
  if (input.totalMarks > 0 && input.marks >= input.totalMarks
    && input.collectedRewards >= input.availableRewards) return "perfect";
  return "complete";
}

export const visibleRewardRows = (summary: QuestionRewardSummary) => [
  { key: "marks", label: "Marks", value: summary.marks, suffix: ` / ${summary.totalMarks}` },
  { key: "completion", label: "Completion coins", value: summary.completionCoins },
  { key: "vault", label: "Vault reward", value: summary.vaultReward },
  { key: "vaults", label: "Vaults opened", value: summary.vaultsOpened },
  { key: "time", label: "Time earned", value: summary.timeEarnedSeconds, suffix: "s" },
  { key: "lives", label: summary.livesDelta >= 0 ? "Lives gained" : "Lives used", value: Math.abs(summary.livesDelta) },
].filter((row) => row.key === "marks" || row.value > 0);