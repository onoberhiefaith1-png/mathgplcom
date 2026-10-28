// Pure rules for the Adventure video's loop and its buffering. The video element
// is driven by these so the decisions are testable without a browser.

/** HAVE_FUTURE_DATA: enough is buffered to play on without stopping right away. */
export const READY_STATE_PLAYABLE = 3;
/** A seek this close to where the playhead already is changes nothing. */
export const SEEK_TOLERANCE_S = 0.25;
/** Wrapping the loop twice inside this window is a double seek, not a second lap. */
export const MIN_WRAP_GAP_MS = 400;
/** How long the picture may sit waiting for data before it is paused and re-started. */
export const STALL_RECOVER_MS = 2500;

export type BufferedRanges = { length: number; start: (i: number) => number; end: (i: number) => number } | null | undefined;

export type VideoLike = {
  readyState: number;
  currentTime: number;
  seeking: boolean;
  paused: boolean;
  buffered?: BufferedRanges;
};

/** True when the video can play on right now (not just "metadata loaded"). */
export function isPlayable(v: Pick<VideoLike, "readyState">): boolean {
  return v.readyState >= READY_STATE_PLAYABLE;
}

/** Is [from, from+ahead] already inside one buffered range? */
export function isBuffered(buffered: BufferedRanges, from: number, ahead = 0.5): boolean {
  if (!buffered) return true; // nothing to check against: assume the browser can cope
  for (let i = 0; i < buffered.length; i++) {
    if (buffered.start(i) <= from + 0.05 && buffered.end(i) >= from + ahead) return true;
  }
  return false;
}

/** Seconds buffered ahead of `t` (0 when `t` is outside every range). */
export function bufferedAhead(buffered: BufferedRanges, t: number): number {
  if (!buffered) return 0;
  for (let i = 0; i < buffered.length; i++) {
    if (buffered.start(i) <= t + 0.05 && buffered.end(i) >= t) return buffered.end(i) - t;
  }
  return 0;
}

/**
 * What the loop engine should do on a tick.
 * - `wrap`: the playhead truly crossed the loop end — seek once to the loop start.
 * - `enter`: the playhead is clearly outside the region (a point just opened) — snap in.
 * - `none`: leave the video alone (inside the region, already seeking, or just wrapped).
 */
export function loopAction(input: {
  t: number;
  region: { start: number; end: number } | null;
  seeking: boolean;
  msSinceLastSeek: number;
  tolerance?: number;
}): "none" | "wrap" | "enter" {
  const { t, region, seeking, msSinceLastSeek } = input;
  const tol = input.tolerance ?? SEEK_TOLERANCE_S;
  if (!region || seeking) return "none";
  if (msSinceLastSeek < MIN_WRAP_GAP_MS) return "none";
  if (t >= region.end) return "wrap";
  if (t < region.start - tol || t > region.end + tol) return "enter";
  return "none";
}

/** Should `el.currentTime = target` be set at all? Not when we are already (about) there. */
export function needsSeek(current: number, target: number, seeking: boolean, tolerance = SEEK_TOLERANCE_S): boolean {
  if (!Number.isFinite(target)) return false;
  if (seeking && Math.abs(current - target) <= tolerance) return false;
  return Math.abs(current - target) > tolerance;
}

/**
 * Stall recovery. `waiting`/`stalled` with the picture short of data for longer
 * than STALL_RECOVER_MS while we want it playing → pause, then play again once
 * the browser reports it can play on.
 */
export function stallStep(input: { wantPlaying: boolean; playable: boolean; paused: boolean; waitedMs: number; recovering: boolean }): "wait" | "pause" | "resume" | "none" {
  const { wantPlaying, playable, paused, waitedMs, recovering } = input;
  if (!wantPlaying) return "none";
  if (playable) return recovering || paused ? "resume" : "none";
  if (!recovering && waitedMs >= STALL_RECOVER_MS) return "pause";
  return "wait";
}
