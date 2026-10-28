/**
 * Live resource registry.
 *
 * Every managed timer, poller, live subscription and listener registers here so
 * a leak becomes measurable instead of a mystery: if the counts do not return
 * to their baseline after leaving a page, something never cleaned up.
 *
 * Zero behavioural cost in production — it is a pair of counters.
 */
export type ResourceKind = "interval" | "timeout" | "raf" | "channel" | "listener" | "operation";

type Entry = { kind: ResourceKind; label: string; at: number };

const entries = new Map<number, Entry>();
let nextId = 1;

export function trackResource(kind: ResourceKind, label: string): number {
  const id = nextId++;
  entries.set(id, { kind, label, at: Date.now() });
  return id;
}

export function releaseResource(id: number | undefined): void {
  if (id !== undefined) entries.delete(id);
}

export function resourceCounts(): Record<ResourceKind, number> {
  const counts: Record<ResourceKind, number> = {
    interval: 0,
    timeout: 0,
    raf: 0,
    channel: 0,
    listener: 0,
    operation: 0,
  };
  for (const entry of entries.values()) counts[entry.kind] += 1;
  return counts;
}

export function resourceSnapshot(): Array<Entry & { id: number; ageMs: number }> {
  const now = Date.now();
  return [...entries.entries()].map(([id, entry]) => ({ id, ...entry, ageMs: now - entry.at }));
}

/** Longest-running entries first — the usual shape of a leak. */
export function oldestResources(limit = 10) {
  return resourceSnapshot()
    .sort((a, b) => b.ageMs - a.ageMs)
    .slice(0, limit);
}

declare global {
  interface Window {
    __mathgplStability?: {
      counts: typeof resourceCounts;
      list: typeof resourceSnapshot;
      oldest: typeof oldestResources;
    };
  }
}

/** Exposed for manual auditing: `__mathgplStability.counts()` in the console. */
export function exposeStabilityDebug(): void {
  if (typeof window === "undefined") return;
  window.__mathgplStability = {
    counts: resourceCounts,
    list: resourceSnapshot,
    oldest: oldestResources,
  };
}
