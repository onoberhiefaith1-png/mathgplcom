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

/** True while a narration clip is audible. */
export const isSpeaking = (): boolean => {
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

// ---------------------------------------------------------------------------
// Narration: one clip at a time, the rest queued in order.
//
// Two clips pinned to the same moment must be *heard* one after the other, so
// the bus owns a queue instead of letting the newest call overwrite the
// element. A queued clip is only replaced by an explicit new batch or a stop.

/** A narration clip waiting for its turn. */
export interface NarrationItem {
  src: string;
  volume?: number;
  /** Learning Point this clip belongs to; `null` = plain timeline. */
  owner?: string | null;
}

let narrationQueue: NarrationItem[] = [];
let narrationCurrent: NarrationItem | null = null;
/** Only the newest gated narration request survives the unlock latch. */
let pendingNarration: (() => void) | null = null;

const gateNarration = (fn: () => void) => {
  if (unlocked) { fn(); return; }
  if (pendingNarration) unlockWaiters.delete(pendingNarration);
  pendingNarration = () => { pendingNarration = null; fn(); };
  unlockWaiters.add(pendingNarration);
};

/** The Learning Point that owns whatever is speaking right now. */
export const narrationOwner = (): string | null | undefined => narrationCurrent?.owner;

const startNarration = (item: NarrationItem) => {
  const s = stateOf("narration");
  const volume = item.volume ?? 1;
  s.volume = volume;
  const el = elementOf("narration");
  if (!el) return;
  narrationCurrent = item;
  el.loop = false;
  el.onended = () => {
    narrationCurrent = null;
    const next = narrationQueue.shift();
    if (next) startNarration(next);
    else applyVolumes();
  };
  el.pause();
  el.src = item.src;
  el.currentTime = 0;
  el.volume = volume;
  s.src = item.src;
  gateNarration(() => {
    void el.play().then(applyVolumes).catch(() => {});
  });
};

/**
 * Play an ordered batch of clips: the first speaks now, the rest follow as each
 * one ends. Replaces any batch still waiting, but never cuts what is speaking
 * unless the batch itself starts something.
 */
export const enqueueNarration = (items: NarrationItem[]): void => {
  if (typeof window === "undefined" || items.length === 0) return;
  const [first, ...rest] = items;
  narrationQueue = rest;
  startNarration(first!);
};

/** Append clips behind whatever is speaking, without interrupting it. */
export const queueNarration = (items: NarrationItem[]): void => {
  if (typeof window === "undefined" || items.length === 0) return;
  if (!narrationCurrent) { enqueueNarration(items); return; }
  narrationQueue = [...narrationQueue, ...items];
};

/** Play a single narration clip immediately, clearing anything queued. */
export const playNarration = (src: string | null, volume = 1): void => {
  if (!src) return;
  enqueueNarration([{ src, volume }]);
};

/** Hold a channel where it is; `resumeChannelPlayback` continues from there. */
export const pauseChannel = (ch: AudioChannel): void => {
  const s = channels.get(ch);
  if (!s?.el) return;
  clearFade(s);
  s.el.pause();
};

/** Continue a paused channel from its current position. */
export const resumeChannelPlayback = (ch: AudioChannel): void => {
  const s = channels.get(ch);
  if (!s?.el || !s.src) return;
  const el = s.el;
  gated(() => {
    void el.play().then(() => { el.volume = effectiveVolume(ch); applyVolumes(); }).catch(() => {});
  });
};

export const stopChannel = (ch: AudioChannel, ms = FADE_MS): void => {
  if (ch === "narration") {
    narrationQueue = [];
    narrationCurrent = null;
    if (pendingNarration) { unlockWaiters.delete(pendingNarration); pendingNarration = null; }
  }
  const s = channels.get(ch);
  if (!s?.el) return;
  const el = s.el;
  if (el.onended) el.onended = null;
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
