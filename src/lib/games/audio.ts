// One audio bus for the whole platform.
//
// Exactly one background track can ever play. Channels:
//
//   global    — the MATHGPL platform soundtrack (outside any game)
//   ambience  — an adventure's own background ambience
//   music     — per Learning Point / scene environmental music
//   narration — spoken clips (ducks `ambience` + `music` while speaking)
//   sfx       — one-shot effects
//
// Browsers refuse to start audio without a user gesture, so every play goes
// through a latch: `unlockAudio()` is called from the first real interaction
// (Start Game, the student "Tap for sound" prompt) and queued tracks resume.

export type AudioChannel = "global" | "ambience" | "music" | "narration" | "sfx";

const FADE_MS = 400;
const DUCK = 0.25;

interface ChannelState {
  el: HTMLAudioElement | null;
  src: string | null;
  loop: boolean;
  volume: number;
  fade: number | null;
}

const channels = new Map<AudioChannel, ChannelState>();
let unlocked = false;
const unlockWaiters = new Set<() => void>();
/** Channels muted while a game owns the audio (the global soundtrack). */
const suspended = new Set<AudioChannel>();

const stateOf = (ch: AudioChannel): ChannelState => {
  let s = channels.get(ch);
  if (!s) {
    s = { el: null, src: null, loop: false, volume: 1, fade: null };
    channels.set(ch, s);
  }
  return s;
};

const elementOf = (ch: AudioChannel): HTMLAudioElement | null => {
  if (typeof window === "undefined") return null;
  const s = stateOf(ch);
  if (!s.el) {
    s.el = new Audio();
    s.el.preload = "auto";
  }
  return s.el;
};

const clearFade = (s: ChannelState) => {
  if (s.fade != null) {
    window.clearInterval(s.fade);
    s.fade = null;
  }
};

const fadeTo = (ch: AudioChannel, target: number, ms = FADE_MS, onDone?: () => void) => {
  const s = stateOf(ch);
  const el = s.el;
  if (!el) { onDone?.(); return; }
  clearFade(s);
  const from = el.volume;
  const steps = Math.max(1, Math.round(ms / 40));
  let i = 0;
  s.fade = window.setInterval(() => {
    i += 1;
    const k = Math.min(1, i / steps);
    el.volume = Math.min(1, Math.max(0, from + (target - from) * k));
    if (k >= 1) {
      clearFade(s);
      onDone?.();
    }
  }, 40);
};

/** True once a user gesture has authorised playback. */
export const audioUnlocked = (): boolean => unlocked;

/** Call from any real user gesture. Resumes anything that was waiting. */
export const unlockAudio = (): void => {
  if (unlocked) return;
  unlocked = true;
  for (const fn of Array.from(unlockWaiters)) {
    unlockWaiters.delete(fn);
    try { fn(); } catch { /* noop */ }
  }
};

const gated = (fn: () => void) => {
  if (unlocked) { fn(); return; }
  unlockWaiters.add(fn);
};

const effectiveVolume = (ch: AudioChannel): number => {
  const s = stateOf(ch);
  if (suspended.has(ch)) return 0;
  const ducked = (ch === "ambience" || ch === "music") && isSpeaking();
  return s.volume * (ducked ? DUCK : 1);
};

const isSpeaking = (): boolean => {
  const el = channels.get("narration")?.el;
  return Boolean(el && !el.paused && !el.ended);
};

const applyVolumes = () => {
  for (const ch of ["global", "ambience", "music"] as AudioChannel[]) {
    const el = channels.get(ch)?.el;
    if (el) fadeTo(ch, effectiveVolume(ch), 200);
  }
};

export interface PlayOptions {
  loop?: boolean;
  volume?: number;
  /** Restart from the beginning even when the same source is already playing. */
  restart?: boolean;
}

/**
 * Play (or keep playing) a looping track on a channel. Passing the same `src`
 * is a no-op, so re-renders never restart the music.
 */
export const playChannel = (ch: AudioChannel, src: string | null, opts: PlayOptions = {}): void => {
  if (typeof window === "undefined") return;
  const s = stateOf(ch);
  s.volume = opts.volume ?? s.volume ?? 1;
  s.loop = opts.loop ?? true;

  if (!src) { stopChannel(ch); return; }
  if (s.src === src && !opts.restart) {
    const el = elementOf(ch);
    if (el?.paused) gated(() => void el.play().catch(() => {}));
    fadeTo(ch, effectiveVolume(ch), FADE_MS);
    return;
  }

  const el = elementOf(ch);
  if (!el) return;
  s.src = src;
  el.loop = s.loop;
  el.src = src;
  el.currentTime = 0;
  el.volume = 0;
  gated(() => {
    void el.play()
      .then(() => fadeTo(ch, effectiveVolume(ch), FADE_MS))
      .catch(() => {});
  });
};

/** Fire a one-shot effect. Effects never interrupt each other. */
export const playSfx = (src: string | null, volume = 1): void => {
  if (!src || typeof window === "undefined") return;
  gated(() => {
    const el = new Audio(src);
    el.volume = Math.min(1, Math.max(0, volume));
    void el.play().catch(() => {});
  });
};

/** Play a narration clip; the background music ducks until it finishes. */
export const playNarration = (src: string | null, volume = 1): void => {
  if (!src || typeof window === "undefined") return;
  const s = stateOf("narration");
  s.volume = volume;
  const el = elementOf("narration");
  if (!el) return;
  el.loop = false;
  el.onended = () => applyVolumes();
  el.pause();
  el.src = src;
  el.currentTime = 0;
  el.volume = volume;
  s.src = src;
  gated(() => {
    void el.play().then(applyVolumes).catch(() => {});
  });
};

export const stopChannel = (ch: AudioChannel, ms = FADE_MS): void => {
  const s = channels.get(ch);
  if (!s?.el) return;
  const el = s.el;
  s.src = null;
  fadeTo(ch, 0, ms, () => {
    el.pause();
    el.currentTime = 0;
  });
};

/** Silence a channel without forgetting it (used for the global soundtrack). */
export const suspendChannel = (ch: AudioChannel): void => {
  if (suspended.has(ch)) return;
  suspended.add(ch);
  const el = channels.get(ch)?.el;
  if (el) fadeTo(ch, 0, FADE_MS, () => el.pause());
};

/** Undo `suspendChannel` and fade the track back in. */
export const resumeChannel = (ch: AudioChannel): void => {
  if (!suspended.delete(ch)) return;
  const s = channels.get(ch);
  if (!s?.el || !s.src) return;
  const el = s.el;
  gated(() => {
    void el.play().then(() => fadeTo(ch, effectiveVolume(ch), FADE_MS)).catch(() => {});
  });
};

/** Set a channel's target volume (0–1). */
export const setChannelVolume = (ch: AudioChannel, volume: number): void => {
  const s = stateOf(ch);
  s.volume = Math.min(1, Math.max(0, volume));
  const el = s.el;
  if (el) fadeTo(ch, effectiveVolume(ch), 150);
};

/**
 * Entering a game: the platform soundtrack steps aside so the adventure's own
 * audio owns the room. Leaving restores it.
 */
export const enterGameAudio = (): void => suspendChannel("global");
export const exitGameAudio = (): void => {
  stopChannel("ambience", 250);
  stopChannel("music", 250);
  stopChannel("narration", 150);
  resumeChannel("global");
};
