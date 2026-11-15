/**
 * Timer Arena — how the Live Report keeps itself fresh. Pure helpers.
 *
 * Three sources feed one screen: a realtime nudge, a steady poll (the safety
 * net when realtime is blocked), and the first load. Responses can arrive out
 * of order, so a snapshot is only accepted when it is not older than the one
 * already on screen.
 */

export type StampedBoard = { generatedAt?: string | null };

/** Keep the newer of two snapshots; an unstamped one never beats a stamped one. */
export function acceptBoard<T extends StampedBoard>(
  current: T | null,
  incoming: T,
): T {
  if (!current) return incoming;
  const a = current.generatedAt ? Date.parse(current.generatedAt) : NaN;
  const b = incoming.generatedAt ? Date.parse(incoming.generatedAt) : NaN;
  if (Number.isFinite(a) && Number.isFinite(b))
    return b >= a ? incoming : current;
  return incoming;
}

export type ChampionView = {
  assessmentId: string;
  top: { name: string; ms: number }[];
};

/** Questions whose champion (name or time) changed — they flash on screen. */
export function changedChampions(
  before: { columns: ChampionView[] } | null,
  after: { columns: ChampionView[] },
): Set<string> {
  const changed = new Set<string>();
  if (!before) return changed;
  for (const col of after.columns) {
    const old = before.columns.find((o) => o.assessmentId === col.assessmentId);
    const now = col.top[0];
    if (now && (old?.top[0]?.ms !== now.ms || old?.top[0]?.name !== now.name))
      changed.add(col.assessmentId);
  }
  return changed;
}

export const POLL_LIVE_MS = 4_000; // realtime connected: a gentle safety net
export const POLL_FALLBACK_MS = 2_000; // realtime not connected: poll quickly
export const POLL_HIDDEN_MS = 20_000; // tab in the background

/** Next poll delay, backing off (never past 30s) while the server is failing. */
export function pollDelayMs(opts: {
  realtime: boolean;
  hidden: boolean;
  failures: number;
}): number {
  const base = opts.hidden
    ? POLL_HIDDEN_MS
    : opts.realtime
      ? POLL_LIVE_MS
      : POLL_FALLBACK_MS;
  const factor = Math.min(4, 1 + Math.max(0, opts.failures));
  return Math.min(30_000, base * factor);
}

/** Wheel/column tint order — the same hues the Mathemagine subject cards use. */
export const SLICE_HUES = [
  "28 95% 58%", // maths orange
  "200 95% 55%", // physics blue
  "268 75% 62%", // chemistry purple
  "158 70% 45%", // emerald
  "320 75% 60%", // magenta
  "42 96% 56%", // gold
  "222 80% 56%", // brand blue
  "8 85% 58%", // coral
] as const;
export const sliceHue = (i: number): string =>
  SLICE_HUES[
    ((i % SLICE_HUES.length) + SLICE_HUES.length) % SLICE_HUES.length
  ]!;

/* ── People on the Live Report ─────────────────────────────────────────── */

export type PersonLook = { name: string; photo: string | null; avatar: string | null };
type PersonSource = {
  participants?: { id: string; name: string; photo: string | null; avatar: string | null }[];
  columns: { top: { participantId?: string; name: string; photo?: string | null; avatar: string | null }[] }[];
};

/** A student's name and picture, wherever the board mentions them. */
export function personFor(board: PersonSource, participantId: string | null | undefined): PersonLook | null {
  if (!participantId) return null;
  const p = board.participants?.find((x) => x.id === participantId);
  if (p) return { name: p.name, photo: p.photo ?? null, avatar: p.avatar ?? null };
  for (const col of board.columns) {
    const e = col.top.find((x) => x.participantId === participantId);
    if (e) return { name: e.name, photo: e.photo ?? null, avatar: e.avatar ?? null };
  }
  return null;
}

/** "just now", "12s ago", "3 min ago" — how fresh the screen is. */
export function freshness(nowMs: number, atMs: number | null | undefined): string {
  if (atMs == null || !Number.isFinite(atMs)) return "waiting";
  const s = Math.max(0, Math.round((nowMs - atMs) / 1000));
  if (s < 3) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)} min ago`;
}

/* ── Theme: the same light/dark choice and palette as the Mathemagine app ── */

export type ReportTheme = "light" | "dark";
export const THEME_KEY = "mathemagine.theme";
export const PALETTE_KEY = "mathemagine.palette";
export const PALETTES = ["ocean", "sunset", "forest"] as const;
export type ReportPalette = (typeof PALETTES)[number];

/** Saved Mathemagine choice first, then the signed-in app theme, then the device. */
export function resolveTheme(saved: string | null | undefined, appTheme: string | null | undefined, prefersDark: boolean): ReportTheme {
  if (saved === "light" || saved === "dark") return saved;
  if (appTheme === "light" || appTheme === "dark") return appTheme;
  return prefersDark ? "dark" : "light";
}
export const resolvePalette = (saved: string | null | undefined): ReportPalette =>
  (PALETTES as readonly string[]).includes(saved ?? "") ? (saved as ReportPalette) : "ocean";

/** Realtime retry delay after the channel drops: 1s, 2s, 4s … capped at 30s. */
export const resubscribeDelayMs = (attempt: number): number => Math.min(30_000, 1000 * 2 ** Math.max(0, Math.min(5, attempt)));
