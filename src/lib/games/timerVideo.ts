// Pure helpers for the Video Timer: the uploaded video IS the clock.
//
//   Intro  — plays once, NOT timed (cinematic content)
//   Loop   — repeats for the whole configured duration (the actual clock)
//   Outro  — failure ending only; never plays on success
//
// The same helpers serve the editor timeline/preview and gameplay, so authoring
// and playing can never disagree.
import type { TimerVideoConfig } from "./types";

export type TimerVideoPhase = "intro" | "loop" | "outro";

export interface TimerRegion {
  start: number;
  end: number;
}

export interface TimerRegions {
  intro: TimerRegion;
  loop: TimerRegion;
  outro: TimerRegion;
  duration: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

/**
 * Resolve the three regions of a Video Timer, filling sensible defaults when
 * the teacher has not dragged the markers yet (first third / middle / last
 * third) and keeping them ordered and inside the video.
 */
export const timerRegionsOf = (
  cfg: TimerVideoConfig | null | undefined,
  videoDuration?: number,
): TimerRegions => {
  const duration = Math.max(0, num(videoDuration ?? cfg?.duration, 0));
  if (duration <= 0) {
    return { intro: { start: 0, end: 0 }, loop: { start: 0, end: 0 }, outro: { start: 0, end: 0 }, duration: 0 };
  }
  const third = duration / 3;

  const introStart = clamp(num(cfg?.introStart, 0), 0, duration);
  const introEnd = clamp(num(cfg?.introEnd, third), introStart, duration);

  const loopStart = clamp(num(cfg?.loopStart, introEnd), introEnd, duration);
  const loopEnd = clamp(num(cfg?.loopEnd, Math.min(duration, loopStart + third)), loopStart, duration);

  const outroStart = clamp(num(cfg?.outroStart, loopEnd), loopEnd, duration);
  const outroEnd = clamp(num(cfg?.outroEnd, duration), outroStart, duration);

  return {
    intro: { start: introStart, end: introEnd },
    loop: { start: loopStart, end: loopEnd },
    outro: { start: outroStart, end: outroEnd },
    duration,
  };
};

/** Length of one lap of the loop region, in seconds. */
export const loopDurationOf = (regions: TimerRegions): number =>
  Math.max(0, regions.loop.end - regions.loop.start);

/** How many laps of the loop cover the configured Timer duration. */
export const lapsNeeded = (regions: TimerRegions, timerSeconds: number): number => {
  const lap = loopDurationOf(regions);
  if (lap <= 0 || timerSeconds <= 0) return 0;
  return Math.ceil(timerSeconds / lap);
};

/** True when the loop region is usable as a clock. */
export const timerVideoReady = (cfg: TimerVideoConfig | null | undefined): boolean => {
  if (!cfg?.storagePath) return false;
  return loopDurationOf(timerRegionsOf(cfg)) > 0.05;
};

/**
 * Where the playhead should go next.
 * While the Timer is running the video never leaves the loop region; on
 * failure it steps into the outro exactly once.
 */
export const nextPhaseTime = (
  regions: TimerRegions,
  phase: TimerVideoPhase,
  playhead: number,
): { phase: TimerVideoPhase; seekTo: number | null } => {
  if (phase === "intro") {
    if (playhead >= regions.intro.end - 0.05) return { phase: "loop", seekTo: regions.loop.start };
    return { phase: "intro", seekTo: null };
  }
  if (phase === "loop") {
    if (playhead >= regions.loop.end - 0.05) return { phase: "loop", seekTo: regions.loop.start };
    return { phase: "loop", seekTo: null };
  }
  return { phase: "outro", seekTo: null };
};

/** mm:ss for a second count. */
export const fmtClock = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

/** Parse "mm:ss", "90s" or plain minutes into seconds. Returns null when empty. */
export const parseClock = (raw: string): number | null => {
  const text = raw.trim();
  if (!text) return null;
  if (text.includes(":")) {
    const [m, s] = text.split(":");
    const mins = Number(m) || 0;
    const secs = Number(s) || 0;
    return Math.max(0, Math.round(mins * 60 + secs));
  }
  const mins = Number(text);
  if (!Number.isFinite(mins)) return null;
  return Math.max(0, Math.round(mins * 60));
};
