// Academia Adventure audio blend — pure rules. The teacher sets how loud the
// Game music is while the narrator speaks and how loud the narrator is; the
// student only has one master volume that scales the whole mix.

export type NarrationSegment = { start: number; end: number };
export type AdventureAudio = {
  /** Game music level while narration plays, 0–1. */
  duckLevel: number;
  /** Narrator (Adventure video sound) level, 0–1. */
  narratorLevel: number;
  segments: NarrationSegment[];
};

export const DEFAULT_AUDIO: AdventureAudio = { duckLevel: 0.1, narratorLevel: 0.7, segments: [] };
export const FADE_SECONDS = 5;

const unit = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
};

export function normalizeAudio(raw: unknown): AdventureAudio {
  const r = (raw ?? {}) as Partial<AdventureAudio>;
  const segments = (Array.isArray(r.segments) ? r.segments : [])
    .map((s) => ({ start: Number(s?.start), end: Number(s?.end) }))
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start && s.start >= 0)
    .sort((a, b) => a.start - b.start);
  return { duckLevel: unit(r.duckLevel, DEFAULT_AUDIO.duckLevel), narratorLevel: unit(r.narratorLevel, DEFAULT_AUDIO.narratorLevel), segments };
}

/**
 * How far the music is ducked at video time t: 0 = normal, 1 = fully at the
 * narration level. Fades in over the 5 s before a segment and out over the
 * 5 s after it; overlapping windows take the deepest duck (no pumping).
 */
export function duckAmount(t: number, segments: NarrationSegment[], fade = FADE_SECONDS): number {
  let best = 0;
  for (const s of segments) {
    let d = 0;
    if (t >= s.start && t <= s.end) d = 1;
    else if (t < s.start && t >= s.start - fade) d = 1 - (s.start - t) / fade;
    else if (t > s.end && t <= s.end + fade) d = 1 - (t - s.end) / fade;
    if (d > best) best = d;
    if (best >= 1) break;
  }
  return best;
}

/** Final music volume: the Game's own level, ducked, then the master volume. */
export function musicVolume(base: number, t: number, audio: AdventureAudio, master: number): number {
  const d = duckAmount(t, audio.segments);
  const level = base * (1 - d) + Math.min(base, audio.duckLevel) * d;
  return unit(level * unit(master, 1), 0);
}

/** Final narrator (video) volume: teacher level × master. */
export function narratorVolume(audio: AdventureAudio, master: number): number {
  return unit(audio.narratorLevel * unit(master, 1), 0);
}
