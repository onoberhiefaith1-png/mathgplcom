// ONE Floating Numbers line ↔ ONE Game writing surface.
//
// Floating Numbers is the mathematical source of truth: it decides how many
// lines exist, what they say, what they are worth and how long each one gets.
// This module holds only the Game-side configuration of those lines, keyed by
// the Floating Numbers line id — never by position, never by a second id.

import { tokensFromEquation } from "@/lib/lessonnotes/floatingCompile";
import type {
  Game,
  LineSurfaceConfig,
  RewardInstance,
  TimeFraction,
  VaultCode,
} from "./types";

export const TIME_FRACTIONS: { id: TimeFraction; label: string; value: number }[] = [
  { id: "full", label: "Full time", value: 1 },
  { id: "half", label: "Half time", value: 1 / 2 },
  { id: "third", label: "One third", value: 1 / 3 },
  { id: "quarter", label: "One quarter", value: 1 / 4 },
];

export const fractionValue = (fraction: TimeFraction | undefined): number =>
  TIME_FRACTIONS.find((item) => item.id === fraction)?.value ?? 1;

/** Seconds a fraction of an existing time is worth. Never a hardcoded bonus. */
export const fractionSeconds = (
  baseSeconds: number | null | undefined,
  fraction: TimeFraction | undefined,
): number => {
  const base = Number(baseSeconds);
  if (!Number.isFinite(base) || base <= 0) return 0;
  return Math.max(1, Math.round(base * fractionValue(fraction)));
};

export const lifeMultiplier = (value: number | undefined): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(10, Math.max(0.1, Math.round(parsed * 10) / 10));
};

export const lifeSeconds = (
  totalSeconds: number | null | undefined,
  multiplier: number | undefined,
): number => {
  const total = Number(totalSeconds);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.max(1, Math.round(total * lifeMultiplier(multiplier)));
};

export const defaultLineConfig = (lineId: string): LineSurfaceConfig => ({
  lineId,
  surfaceId: null,
  hourglassReward: "full",
  vaultCodes: [],
});

/**
 * Legacy Game-side codes remain readable only until the corresponding Floating
 * Numbers line saves its own `vaults` array.
 */
const readVaultCodes = (raw: Partial<LineSurfaceConfig> | undefined): VaultCode[] => {
  const listed = Array.isArray(raw?.vaultCodes) ? raw!.vaultCodes : [];
  const codes = listed
    .map((code) => ({
      expression: String(code?.expression ?? "").trim(),
      reward: Number.isFinite(Number(code?.reward)) ? Math.max(0, Number(code.reward)) : 1,
    }))
    .filter((code) => code.expression.length > 0);
  const legacy = String(raw?.vaultExpression ?? "").trim();
  if (codes.length === 0 && legacy) {
    const reward = Number(raw?.vaultCoins);
    codes.push({ expression: legacy, reward: Number.isFinite(reward) ? Math.max(0, reward) : 1 });
  }
  return codes;
};

export const normalizeLineConfig = (
  lineId: string,
  raw: Partial<LineSurfaceConfig> | undefined,
): LineSurfaceConfig => ({
  ...defaultLineConfig(lineId),
  ...(raw ?? {}),
  lineId,
  vaultCodes: readVaultCodes(raw),
});

export const lineConfigOf = (
  game: Pick<Game, "settings">,
  lineId: string | null | undefined,
): LineSurfaceConfig =>
  normalizeLineConfig(lineId ?? "", lineId ? game.settings.lines?.[lineId] : undefined);

/**
 * Attaching or re-reading an exercise. Lines that still exist keep everything
 * the teacher configured; new lines gain a surface; removed lines lose theirs.
 */
export const syncLineSurfaces = (
  current: Record<string, LineSurfaceConfig> | undefined,
  lineIds: string[],
): Record<string, LineSurfaceConfig> => {
  const next: Record<string, LineSurfaceConfig> = {};
  for (const id of lineIds) {
    if (!id) continue;
    next[id] = normalizeLineConfig(id, current?.[id]);
  }
  return next;
};

/** True when the saved configuration already matches these lines exactly. */
export const lineSurfacesInSync = (
  current: Record<string, LineSurfaceConfig> | undefined,
  lineIds: string[],
): boolean => {
  const wanted = lineIds.filter(Boolean);
  const have = Object.keys(current ?? {});
  return have.length === wanted.length && wanted.every((id) => Boolean(current?.[id]));
};

/* ── Vault matching ─────────────────────────────────────────────────────────
 * The Vault rewards the teacher's intended METHOD. It compares an ordered,
 * consecutive mathematical token sequence and deliberately does not use the
 * AI/canonical equivalence engine.
 */

const normalizeToken = (text: string): string =>
  text
    .replace(/[−–—]/g, "-")
    .replace(/[×·∙*]/g, "*")
    .replace(/÷/g, "/")
    .replace(/\s+/g, "")
    .toLowerCase();

const sequenceOf = (text: string): string[] =>
  tokensFromEquation(text)
    .flatMap((token) => {
      const normalized = normalizeToken(token);
      if (/^\\(?:frac|dfrac|tfrac|sqrt|root|begin|left|sum|prod|int|oint|lim)\b/.test(normalized)) {
        return [normalized];
      }
      return normalized.split(/([+\-=<>*/])/).filter(Boolean);
    })
    .filter(Boolean);

/**
 * Does the student's work on this line contain the teacher's expected method?
 * Mathematical meaning only. A partial character sequence must never open a
 * Vault; exact normalisation handles notation while canonical comparison
 * handles equivalent mathematical structure.
 */
export const vaultMatches = (
  expression: string | null | undefined,
  work: string | null | undefined,
): boolean => {
  const wanted = (expression ?? "").trim();
  const written = (work ?? "").trim();
  if (!wanted || !written) return false;
  const target = sequenceOf(wanted);
  if (target.length === 0) return false;
  for (const row of written.split(/\n+/)) {
    const sequence = sequenceOf(row);
    for (let start = 0; start <= sequence.length - target.length; start += 1) {
      if (target.every((token, offset) => sequence[start + offset] === token)) return true;
    }
  }
  return false;
};

/* ── Editor preview ─────────────────────────────────────────────────────────
 * Selecting an attached question in the Game editor shows that exercise's real
 * mathematics on the chosen material: one writing surface per Floating Numbers
 * line, with the pattern's objects. It is a PREVIEW — the mathematics is still
 * owned and edited in Floating Numbers, never here.
 */
export interface PreviewLine {
  equation: string;
  lineId?: string | null;
}

export interface RenderedLineInput {
  line: number;
  isQuestion: boolean;
  lineId: string | null;
  patternSlot: number;
  text: string;
  rewards: RewardInstance[];
}

/**
 * One canonical Edit/Play resolver. The saved pattern slot remains the visual
 * source of truth; a line-specific surface replaces it only when the teacher
 * explicitly chose one. Runtime mathematics may replace text and reward state,
 * but never scene, scale, material, or the saved reward coordinates.
 */
export const resolveRenderedLineSlot = (
  game: Game,
  row: RenderedLineInput,
): Game["slots"][number] => {
  const patternIndex = row.isQuestion ? 0 : Math.max(0, row.patternSlot - 1);
  const base = game.slots[patternIndex] ?? game.slots[0];
  if (!base) {
    throw new Error("A saved Game must contain at least one pattern slot.");
  }
  const explicitSurface = row.lineId
    ? game.settings.lines?.[row.lineId]?.surfaceId
    : undefined;
  return {
    ...base,
    id: `line-${row.line}`,
    surfaceId: explicitSurface ?? base.surfaceId ?? null,
    text: row.text,
    hiddenContent: "",
    contentState: "visible",
    rewards: row.rewards,
  };
};

export const previewSlots = (
  game: Game,
  lines: PreviewLine[],
  rewardsFor: (line: number) => RewardInstance[],
): Game["slots"] => {
  if (lines.length === 0) return game.slots;
  return lines.map((row, i) => {
    const line = i + 1;
    const patternSlot = ((line - 1) % Math.max(1, game.slots.length)) + 1;
    const resolved = resolveRenderedLineSlot(game, {
      line,
      isQuestion: false,
      lineId: row.lineId ?? null,
      patternSlot,
      text: row.equation ?? "",
      rewards: rewardsFor(line),
    });
    return { ...resolved, id: `preview-${line}` };
  });
};
