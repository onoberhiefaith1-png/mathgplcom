// ONE Floating Numbers line ↔ ONE Game writing surface.
//
// Floating Numbers is the mathematical source of truth: it decides how many
// lines exist, what they say, what they are worth and how long each one gets.
// This module holds only the Game-side configuration of those lines, keyed by
// the Floating Numbers line id — never by position, never by a second id.

import { canonical, canonicalEqual } from "@/lib/smartboard/canonical";
import { rewardsForLine } from "./pattern";
import type { Game, LineSurfaceConfig, TimeFraction } from "./types";

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

export const defaultLineConfig = (lineId: string): LineSurfaceConfig => ({
  lineId,
  surfaceId: null,
  hourglassReward: "full",
  vaultExpression: null,
  vaultCoins: 1,
});

export const normalizeLineConfig = (
  lineId: string,
  raw: Partial<LineSurfaceConfig> | undefined,
): LineSurfaceConfig => ({ ...defaultLineConfig(lineId), ...(raw ?? {}), lineId });

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
 * The Vault rewards the teacher's intended METHOD, so it compares mathematics,
 * not strings. Text is normalised first, then the existing canonical engine
 * decides equality where it can parse both sides.
 */

const flatten = (text: string): string =>
  text
    .replace(/[−–—]/g, "-")
    .replace(/[×·∙*]/g, "*")
    .replace(/÷/g, "/")
    .replace(/\s+/g, "")
    .toLowerCase();

const sameMath = (a: string, b: string): boolean => {
  if (!a || !b) return false;
  if (flatten(a) === flatten(b)) return true;
  const ca = canonical(a);
  const cb = canonical(b);
  return Boolean(ca && cb && canonicalEqual(ca, cb));
};

/** Every comparable piece of one written line: the whole line and each side. */
const piecesOf = (text: string): string[] => {
  const out: string[] = [];
  for (const row of text.split(/\n+/)) {
    const line = row.trim();
    if (!line) continue;
    out.push(line);
    for (const side of line.split(/=/)) {
      const part = side.trim();
      if (part) out.push(part);
    }
  }
  return out;
};

/**
 * Does the student's work on this line contain the teacher's expected method?
 * Mathematical meaning first, normalised text as the fallback.
 */
export const vaultMatches = (
  expression: string | null | undefined,
  work: string | null | undefined,
): boolean => {
  const wanted = (expression ?? "").trim();
  const written = (work ?? "").trim();
  if (!wanted || !written) return false;
  const wantedPieces = piecesOf(wanted);
  for (const piece of piecesOf(written)) {
    for (const target of wantedPieces) {
      if (sameMath(piece, target)) return true;
    }
    if (flatten(piece).includes(flatten(wanted))) return true;
  }
  return false;
};

/* ── Editor preview ─────────────────────────────────────────────────────────
 * Selecting an attached question in the Game editor shows that exercise's real
 * mathematics on the chosen material: one writing surface per Floating Numbers
 * line, with the pattern's objects. It is a PREVIEW — the mathematics is still
 * owned and edited in Floating Numbers, never here.
 */
export const previewSlots = (
  game: Game,
  lineEquations: string[],
): Game["slots"] => {
  if (lineEquations.length === 0) return game.slots;
  return lineEquations.map((equation, i) => {
    const line = i + 1;
    const source = game.slots[(line - 1) % Math.max(1, game.slots.length)]!;
    return {
      ...source,
      id: `preview-${line}`,
      text: equation ?? "",
      rewards: rewardsForLine(game, line),
    };
  });
};
