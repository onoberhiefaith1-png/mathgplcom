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
