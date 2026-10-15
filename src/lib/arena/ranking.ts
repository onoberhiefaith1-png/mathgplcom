/**
 * Timer Arena — pure ranking rules shared by the server route and the screens.
 *
 * One share = one participation group. Every function here works on rows of a
 * SINGLE group; nothing ever combines two groups.
 */

export type ArenaBest = {
  participantId: string;
  bestMs: number;
  /** ISO time the retained best was first achieved. */
  achievedAt: string;
  attemptId: string;
};

/** Faster first; on an exact tie the earlier achiever stays ahead; then id. */
export function compareBest(a: ArenaBest, b: ArenaBest): number {
  if (a.bestMs !== b.bestMs) return a.bestMs - b.bestMs;
  const ta = Date.parse(a.achievedAt);
  const tb = Date.parse(b.achievedAt);
  if (ta !== tb) return ta - tb;
  return a.attemptId < b.attemptId ? -1 : a.attemptId > b.attemptId ? 1 : 0;
}

export const rankBests = (rows: ArenaBest[]): ArenaBest[] => [...rows].sort(compareBest);

/** A personal best only changes on a STRICTLY faster valid time. */
export const isStrictlyFaster = (prevMs: number | null | undefined, nextMs: number): boolean =>
  nextMs > 0 && (prevMs == null || nextMs < prevMs);

export type MyPosition =
  | { ranked: false; rankedCount: number }
  | {
      ranked: true;
      place: number;
      rankedCount: number;
      champion: boolean;
      inTopFive: boolean;
      /** ms behind the place directly above, null when first. */
      behindNextMs: number | null;
      /** ms to improve to beat 5th place, null when already in the Top 5. */
      toTopFiveMs: number | null;
    };

export function myPosition(sorted: ArenaBest[], participantId: string): MyPosition {
  const idx = sorted.findIndex((r) => r.participantId === participantId);
  if (idx < 0) return { ranked: false, rankedCount: sorted.length };
  const me = sorted[idx]!;
  const above = idx > 0 ? sorted[idx - 1]! : null;
  const fifth = sorted[4];
  return {
    ranked: true,
    place: idx + 1,
    rankedCount: sorted.length,
    champion: idx === 0,
    inTopFive: idx < 5,
    behindNextMs: above ? me.bestMs - above.bestMs : null,
    // Ties keep the earlier achiever ahead, so you must be strictly faster.
    toTopFiveMs: idx < 5 || !fifth ? null : me.bestMs - fifth.bestMs + 1,
  };
}

/** 360° ÷ number of questions on the wheel page. */
export const sectorAngle = (count: number): number => (count > 0 ? 360 / count : 360);

/** Split a long session into readable wheel pages ("Q1–8", "Q9–16"). */
export function wheelPages<T>(items: T[], perPage = 8): { label: string; start: number; items: T[] }[] {
  const pages: { label: string; start: number; items: T[] }[] = [];
  for (let i = 0; i < items.length; i += perPage) {
    const slice = items.slice(i, i + perPage);
    const a = i + 1;
    const b = i + slice.length;
    pages.push({ label: a === b ? `Q${a}` : `Q${a}–${b}`, start: i, items: slice });
  }
  return pages;
}

/** Tolerance for network delay between the device clock and the server clock. */
export const CLOCK_TOLERANCE_MS = 1500;

/**
 * The competitive time. The device's own paused-aware time is used only when
 * the server clock confirms it is possible; otherwise the server time wins.
 */
export function verifiedElapsed(clientMs: number, serverMs: number): number | null {
  if (!Number.isFinite(serverMs) || serverMs <= 0) return null;
  const c = Math.floor(Number(clientMs) || 0);
  if (c > 0 && c <= serverMs + CLOCK_TOLERANCE_MS) return c;
  return Math.floor(serverMs);
}

const BLOCKED = [
  "fuck", "shit", "bitch", "cunt", "dick", "pussy", "nigg", "fag", "slut", "whore", "bastard", "rape", "porn", "sex",
];

/** Clean a display name; returns null when empty or inappropriate. */
export function cleanDisplayName(raw: unknown): string | null {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 24);
  if (s.length < 2) return null;
  const flat = s.toLowerCase().replace(/[^a-z]/g, "");
  if (BLOCKED.some((w) => flat.includes(w))) return null;
  return s;
}

export type EntryRule = "off" | "optional" | "required";
export type EntryConfig = { name: EntryRule; photo: EntryRule };

export const normaliseEntry = (raw: unknown): EntryConfig => {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pick = (v: unknown): EntryRule => (v === "off" || v === "required" ? v : "optional");
  return { name: pick(r["name"]), photo: pick(r["photo"]) };
};

/** The built-in avatars every student may choose instead of a photo. */
export const ARENA_AVATARS = [
  { key: "fox", emoji: "🦊" }, { key: "owl", emoji: "🦉" }, { key: "lion", emoji: "🦁" },
  { key: "panda", emoji: "🐼" }, { key: "tiger", emoji: "🐯" }, { key: "koala", emoji: "🐨" },
  { key: "frog", emoji: "🐸" }, { key: "octopus", emoji: "🐙" }, { key: "rocket", emoji: "🚀" },
  { key: "star", emoji: "⭐" }, { key: "robot", emoji: "🤖" }, { key: "unicorn", emoji: "🦄" },
] as const;

export const avatarEmoji = (key: string | null | undefined): string =>
  ARENA_AVATARS.find((a) => a.key === key)?.emoji ?? "🙂";

export const formatArenaMs = (ms: number | null | undefined): string => {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
};

export const ordinal = (n: number): string => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
};
