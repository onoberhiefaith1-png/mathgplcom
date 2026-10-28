// LOCAL LIVE BRIDGE — same-page delivery of the board's live feed.
//
// The student board publishes its live snapshot / check verdicts on a
// Supabase broadcast channel configured with `broadcast: { self: false }`.
// That is correct for the real case (student device → teacher device), but
// it silently drops every message when the board and the Evaluation panel
// live in the SAME tab — exactly what the Floating Number test sitting is.
//
// This module is a tiny in-page publish/subscribe that carries the SAME
// payloads at the SAME moments. It never replaces the realtime channel; it
// is an additional feed used only when publisher and subscriber share a page.

export type LocalLiveEvent = "board" | "check";

type Handler = (payload: unknown) => void;

const subs = new Map<string, Set<Handler>>();

const keyOf = (channel: string, event: LocalLiveEvent) => `${channel}::${event}`;

/** Stable channel name — identical shape to the realtime channel name. */
export const localLiveChannel = (assessmentId: string, studentId: string) =>
  `assessment-live-${assessmentId}-${studentId}`;

export const publishLocalLive = (
  channel: string | null | undefined,
  event: LocalLiveEvent,
  payload: unknown,
): void => {
  if (!channel) return;
  const set = subs.get(keyOf(channel, event));
  if (!set || set.size === 0) return;
  for (const fn of Array.from(set)) {
    try { fn(payload); } catch { /* one bad subscriber never breaks the board */ }
  }
};

export const subscribeLocalLive = (
  channel: string | null | undefined,
  event: LocalLiveEvent,
  handler: Handler,
): (() => void) => {
  if (!channel) return () => {};
  const k = keyOf(channel, event);
  const set = subs.get(k) ?? new Set<Handler>();
  set.add(handler);
  subs.set(k, set);
  return () => {
    const cur = subs.get(k);
    if (!cur) return;
    cur.delete(handler);
    if (cur.size === 0) subs.delete(k);
  };
};
