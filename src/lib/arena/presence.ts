/**
 * Timer Arena — who is active right now.
 *
 * A student is ACTIVE when the server has heard from their device (a heartbeat,
 * a start, a finish, or the Session's own guest heartbeat) within
 * ACTIVE_WINDOW_MS. Devices beat every BEAT_EVERY_MS, so one missed beat does
 * not flicker the dot. Everything here is pure.
 */

export const BEAT_EVERY_MS = 15_000;
export const ACTIVE_WINDOW_MS = 45_000;

export type Presence = "active" | "inactive";

/** Latest valid ISO time among the candidates, as epoch ms (or null). */
export function latestSeen(
  ...times: Array<string | number | null | undefined>
): number | null {
  let best: number | null = null;
  for (const t of times) {
    const ms = typeof t === "number" ? t : t ? Date.parse(t) : NaN;
    if (Number.isFinite(ms) && (best == null || ms > best)) best = ms;
  }
  return best;
}

export function presenceOf(
  lastSeenMs: number | null | undefined,
  nowMs: number,
  windowMs = ACTIVE_WINDOW_MS,
): Presence {
  if (lastSeenMs == null || !Number.isFinite(lastSeenMs)) return "inactive";
  // A device clock a little ahead of the server must not read as "never seen".
  return nowMs - lastSeenMs <= windowMs ? "active" : "inactive";
}

export type PresenceCounts = {
  joined: number;
  active: number;
  inactive: number;
};

export function countPresence(
  people: Array<{ presence: Presence }>,
): PresenceCounts {
  const active = people.filter((p) => p.presence === "active").length;
  return { joined: people.length, active, inactive: people.length - active };
}

/** Active first, then most recently seen, then name — stable for a screen. */
export function sortParticipants<
  T extends { presence: Presence; lastSeenAt: number | null; name: string },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.presence !== b.presence) return a.presence === "active" ? -1 : 1;
    const ta = a.lastSeenAt ?? 0;
    const tb = b.lastSeenAt ?? 0;
    if (ta !== tb) return tb - ta;
    return a.name.localeCompare(b.name);
  });
}

/** "just now", "12s ago", "3 min ago" — for last-updated and last-seen text. */
export function agoText(ms: number | null | undefined, nowMs: number): string {
  if (ms == null) return "never";
  const s = Math.max(0, Math.round((nowMs - ms) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}
