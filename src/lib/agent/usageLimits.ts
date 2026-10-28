// Phase 6 — ceilings, so nobody can leave Aura running all day by accident.
//
// Two honest limits, both on the teacher's own device:
//  • a daily number of requests, counted per calendar day and reset at midnight;
//  • an idle pause, so her ear switches itself off when nobody is speaking to
//    her for a long stretch.
// Client-safe: the cockpit reads and writes these, and tells the teacher plainly
// when a limit is reached rather than working silently.

export const DAILY_REQUEST_CEILING = 250;
/** Warn once the teacher is this far through the day's allowance. */
export const WARN_AT = 0.8;
/** Her ear switches off after this long with nothing said to her. */
export const IDLE_PAUSE_MS = 15 * 60 * 1000;

const USAGE_KEY = "mathgpl:aura:usage";

export type AuraUsage = { day: string; used: number };

export function today(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function readUsage(now = new Date()): AuraUsage {
  const fresh = { day: today(now), used: 0 };
  if (typeof window === "undefined") return fresh;
  try {
    const raw = window.localStorage.getItem(USAGE_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as Partial<AuraUsage>;
    if (parsed?.day !== fresh.day || typeof parsed.used !== "number") return fresh;
    return { day: fresh.day, used: Math.max(0, Math.floor(parsed.used)) };
  } catch {
    return fresh;
  }
}

export function countRequest(now = new Date()): AuraUsage {
  const next = { day: today(now), used: readUsage(now).used + 1 };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(USAGE_KEY, JSON.stringify(next));
    } catch {
      /* a blocked store only means the count restarts */
    }
  }
  return next;
}

export const remainingRequests = (usage: AuraUsage): number =>
  Math.max(0, DAILY_REQUEST_CEILING - usage.used);

export const ceilingReached = (usage: AuraUsage): boolean =>
  usage.used >= DAILY_REQUEST_CEILING;

/** Plain words about the day's allowance, or null when there is nothing to say. */
export function describeUsage(usage: AuraUsage): string | null {
  const left = remainingRequests(usage);
  if (left === 0) {
    return "You've reached today's limit for Aura. She'll be ready again tomorrow.";
  }
  if (usage.used >= DAILY_REQUEST_CEILING * WARN_AT) {
    return `${left} more requests to Aura today.`;
  }
  return null;
}
