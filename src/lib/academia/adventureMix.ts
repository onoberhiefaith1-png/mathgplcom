// Academia Adventure audio blend — pure rules. The teacher uploads the
// Adventure music, sets its normal level, its level while the narrator speaks,
// the narrator's level and separate fade-in / fade-out seconds. The student
// only has one master volume that scales the whole mix.

export type NarrationSegment = { start: number; end: number };
export type AdventureAudio = {
  /** Teacher-uploaded Adventure music (game asset path); null = use the Game's music. */
  music: { path: string; name?: string } | null;
  /** Normal music level, 0–1. */
  musicVolume: number;
  /** Music level while narration plays, 0–1. */
  duckLevel: number;
  /** Narrator level, 0–1. */
  narratorLevel: number;
  /** Seconds the music takes to go down before a narration. */
  fadeIn: number;
  /** Seconds the music takes to come back up after a narration. */
  fadeOut: number;
  segments: NarrationSegment[];
};

export const FADE_SECONDS = 5;
export const DEFAULT_AUDIO: AdventureAudio = {
  music: null, musicVolume: 0.6, duckLevel: 0.1, narratorLevel: 0.7,
  fadeIn: FADE_SECONDS, fadeOut: FADE_SECONDS, segments: [],
};

const unit = (v: unknown, fallback: number) => {
  const n = Number(v);
  return v !== null && v !== undefined && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
};
const secs = (v: unknown, fallback: number) => {
  const n = Number(v);
  return v !== null && v !== undefined && Number.isFinite(n) ? Math.min(30, Math.max(0, n)) : fallback;
};

export function normalizeAudio(raw: unknown): AdventureAudio {
  const r = (raw ?? {}) as Partial<AdventureAudio>;
  const segments = (Array.isArray(r.segments) ? r.segments : [])
    .map((s) => ({ start: Number(s?.start), end: Number(s?.end) }))
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start && s.start >= 0)
    .sort((a, b) => a.start - b.start);
  const music = r.music && typeof r.music.path === "string" && r.music.path ? { path: r.music.path, name: r.music.name } : null;
  return {
    music,
    musicVolume: unit(r.musicVolume, DEFAULT_AUDIO.musicVolume),
    duckLevel: unit(r.duckLevel, DEFAULT_AUDIO.duckLevel),
    narratorLevel: unit(r.narratorLevel, DEFAULT_AUDIO.narratorLevel),
    fadeIn: secs(r.fadeIn, FADE_SECONDS),
    fadeOut: secs(r.fadeOut, FADE_SECONDS),
    segments,
  };
}

/** Narration windows from clip start times and measured clip lengths. */
export function segmentsFromClips(clips: { at: number; duration: number }[]): NarrationSegment[] {
  return clips
    .filter((c) => Number.isFinite(c.at) && c.at >= 0 && Number.isFinite(c.duration) && c.duration > 0)
    .map((c) => ({ start: c.at, end: c.at + c.duration }))
    .sort((a, b) => a.start - b.start);
}

/**
 * How far the music is ducked at video time t: 0 = normal, 1 = fully at the
 * narration level. Fades down over `fadeIn` seconds before a segment and back
 * up over `fadeOut` seconds after; overlaps take the deepest duck.
 */
export function duckAmount(t: number, segments: NarrationSegment[], fadeIn = FADE_SECONDS, fadeOut = fadeIn): number {
  let best = 0;
  for (const s of segments) {
    let d = 0;
    if (t >= s.start && t <= s.end) d = 1;
    else if (t < s.start && t >= s.start - fadeIn) d = fadeIn > 0 ? 1 - (s.start - t) / fadeIn : 0;
    else if (t > s.end && t <= s.end + fadeOut) d = fadeOut > 0 ? 1 - (t - s.end) / fadeOut : 0;
    if (d > best) best = d;
    if (best >= 1) break;
  }
  return best;
}

/** Final music volume: the normal level, ducked, then the master volume. */
export function musicVolume(base: number, t: number, audio: AdventureAudio, master: number): number {
  const d = duckAmount(t, audio.segments, audio.fadeIn, audio.fadeOut);
  const level = base * (1 - d) + Math.min(base, audio.duckLevel) * d;
  return unit(level * unit(master, 1), 0);
}

/** Final narrator volume: teacher level × master. */
export function narratorVolume(audio: AdventureAudio, master: number): number {
  return unit(audio.narratorLevel * unit(master, 1), 0);
}

/** The live player ducks only while a voice is actually playing, not on video laps. */
export function liveNarrationMusicVolume(audio: AdventureAudio, speaking: boolean, master: number): number {
  return unit((speaking ? Math.min(audio.musicVolume, audio.duckLevel) : audio.musicVolume) * unit(master, 1), 0);
}
