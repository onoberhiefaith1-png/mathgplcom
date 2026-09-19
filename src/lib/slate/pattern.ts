// The Game's Lines come from FLOATING NUMBERS, one for one.
//
//   Question Line (Line 0) — read-only, outside the pattern, no rewards.
//   Game Line N (N >= 1)   — Floating Numbers Line N. Its physical objects are
//                            the teacher's repeating reward pattern slot
//                            ((N - 1) mod patternLength) + 1, PLUS the two
//                            derived objects the line itself owns:
//                              • the Hourglass, when the line has its own time
//                              • the Vault, when the line has an expected method
//
// Empty pattern positions stay empty: nothing is ever auto-inserted.

import { fractionSeconds, lineConfigOf } from "./lineSurfaces";
import type { FloatingVault } from "@/lib/lessonnotes/floatingCompile";
import type { Game, LineSurfaceConfig, RewardInstance, VaultCode } from "./types";

/** The Question Line always sits at index 0 and never takes a pattern slot. */
export const QUESTION_LINE = 0;

/** Objects a teacher can no longer place by hand: the line owns them. */
const DERIVED_TYPES = new Set(["time-shard", "math-vault"]);

/** How many Lines the teacher's reward pattern is long. */
export const patternLengthOf = (game: Pick<Game, "slots" | "patternLength">): number => {
  const declared = Number(game.patternLength);
  if (Number.isFinite(declared) && declared > 0) {
    return Math.min(Math.floor(declared), game.slots.length);
  }
  return game.slots.length;
};

/** Zero-based pattern slot used by Game Line `lineNumber` (1-based). */
export const patternSlotIndex = (lineNumber: number, patternLength: number): number => {
  if (patternLength <= 0 || lineNumber < 1) return -1;
  return (lineNumber - 1) % patternLength;
};

/** Rewards shown on Game Line `lineNumber`. Line 0 (the Question) has none. */
export const rewardsForLine = (
  game: Pick<Game, "slots" | "patternLength">,
  lineNumber: number,
): RewardInstance[] => {
  const index = patternSlotIndex(lineNumber, patternLengthOf(game));
  if (index < 0) return [];
  return game.slots[index]?.rewards ?? [];
};

export interface MappedLine {
  /** 0 = the Question Line, 1..n = solving Lines. */
  line: number;
  isQuestion: boolean;
  /** Floating Numbers line id — the shared identity between both systems. */
  lineId: string | null;
  /** Which pattern position this Line borrows, 1-based. 0 for the Question. */
  patternSlot: number;
  rewards: RewardInstance[];
  /** Seconds on this Floating Numbers line, when the teacher set one. */
  timerSeconds: number | null;
  /** Seconds this line's Hourglass awards when the line is solved in time. */
  hourglassSeconds: number;
  /** The expected method this line's first Vault opens for, when configured. */
  vaultExpression: string | null;
  /** Every Vault Code owned by this line. */
  vaultCodes: VaultCode[];
  vaultCoins: number;
}

/** One Floating Numbers line, as far as the Game needs to know. */
export type LineTimerInput = number | null | undefined;

/**
 * The complete Line map a question produces inside this Game: Line 0 plus one
 * Line per Floating Numbers line. Each Line carries its pattern rewards and the
 * objects the line itself owns (Hourglass from its time, Vault from its method).
 */
export const mapQuestionLines = (
  game: Pick<Game, "slots" | "patternLength"> & Partial<Pick<Game, "settings">>,
  lineTimers: LineTimerInput[],
  lineIds: (string | null | undefined)[] = [],
  lineVaults: (FloatingVault[] | null | undefined)[] = [],
): MappedLine[] => {
  const patternLength = patternLengthOf(game);
  const settings = game.settings;
  const rows: MappedLine[] = [
    {
      line: QUESTION_LINE,
      isQuestion: true,
      lineId: null,
      patternSlot: 0,
      rewards: [],
      timerSeconds: null,
      hourglassSeconds: 0,
      vaultExpression: null,
      vaultCodes: [],
      vaultCoins: 0,
    },
  ];

  lineTimers.forEach((seconds, i) => {
    const line = i + 1;
    const raw = Number(seconds);
    const timerSeconds = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : null;
    const lineId = lineIds[i] ?? null;
    const config: LineSurfaceConfig | null =
      settings && lineId ? lineConfigOf({ settings }, lineId) : null;

    // the pattern never supplies a line-owned object
    const placed = rewardsForLine(game, line).filter((reward) => !DERIVED_TYPES.has(reward.type));
    const derived: RewardInstance[] = [{
      id: "completion",
      type: "mark-seal",
      state: "dormant",
      hidden: false,
      x: 50,
      y: 50,
    }];

    const hourglassSeconds = timerSeconds
      ? fractionSeconds(timerSeconds, config?.hourglassReward ?? "full")
      : 0;
    if (timerSeconds) {
      // the Hourglass belongs on the RIGHT-HAND side of its own line
      derived.push({
        id: "hourglass",
        type: "time-shard",
        state: "dormant",
        hidden: false,
        x: 88,
        y: 26,
        durationMs: hourglassSeconds * 1000,
      });
    }

    // One Vault per Vault Code the teacher wrote on this line. Nothing else.
    const floatingVaults = lineVaults[i];
    const vaultCodes = floatingVaults !== null && floatingVaults !== undefined
      ? floatingVaults.map((vault) => ({ id: vault.id, expression: vault.expression, reward: 1 }))
      : (config?.vaultCodes ?? []);
    vaultCodes.forEach((code, index) => {
      const expression = (code?.expression ?? "").trim();
      if (!expression) return;
      derived.push({
        id: `vault-${code.id ?? index + 1}`,
        type: "math-vault",
        state: "dormant",
        hidden: false,
        x: 14 + (index % 5) * 16,
        y: 62 + Math.floor(index / 5) * 22,
        expression,
        coins: Math.max(0, Math.floor(Number(code.reward ?? 1)) || 0),
      });
    });
    const vaultExpression = vaultCodes[0]?.expression?.trim() || null;

    rows.push({
      line,
      isQuestion: false,
      lineId,
      patternSlot: patternSlotIndex(line, patternLength) + 1,
      rewards: [...placed, ...derived],
      timerSeconds,
      hourglassSeconds,
      vaultExpression,
      vaultCodes,
      vaultCoins: Math.max(0, Math.floor(Number(vaultCodes[0]?.reward ?? 1)) || 0),
    });
  });

  return rows;
};
