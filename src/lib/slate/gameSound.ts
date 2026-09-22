// Game Sound playback.
//
//   • ONE persistent background instance. Re-asking for the same sound is a
//     no-op, so changing Line 1 → 2 → 3 never restarts or reloads it.
//   • Reward sounds are separate one-shots, fired by a reward's own activation.
//     Several may sound at once and none of them touches the background.
//
// Nothing here ever awaits inside the Game's own work: every call returns
// immediately and any loading or browser refusal is swallowed, so audio can
// never pause, delay or block typing, marking, rewards, timers or progress.

import { assetUrl, cachedAssetUrl } from "./assets";
import type { GameSoundSettings, RewardSoundKey, SoundSlot } from "./types";

const clamp = (value: number) => Math.min(1, Math.max(0, Number(value) || 0));

/* ── the first real gesture authorises playback ─────────────────────────── */

let unlocked = false;
let pendingStart: (() => void) | null = null;

const flush = () => {
  unlocked = true;
  const fn = pendingStart;
  pendingStart = null;
  fn?.();
};

if (typeof window !== "undefined") {
  const once = () => {
    window.removeEventListener("pointerdown", once);
    window.removeEventListener("keydown", once);
    window.removeEventListener("touchstart", once);
    flush();
  };
  window.addEventListener("pointerdown", once, { passive: true });
  window.addEventListener("keydown", once);
  window.addEventListener("touchstart", once, { passive: true });
}

/* ── URLs ───────────────────────────────────────────────────────────────── */

const resolved = new Map<string, string>();

const urlFor = (path: string): string | null =>
  resolved.get(path) ?? cachedAssetUrl(path) ?? null;

/** Resolves and remembers a sound's URL. Never throws. */
export const prepareSound = async (path: string | null | undefined): Promise<string | null> => {
  if (!path) return null;
  const known = urlFor(path);
  if (known) return known;
  try {
    const url = await assetUrl(path);
    if (url) resolved.set(path, url);
    return url;
  } catch {
    return null;
  }
};

/* ── background: one element for the whole session ──────────────────────── */

let bg: HTMLAudioElement | null = null;
let bgPath: string | null = null;

const bgElement = (): HTMLAudioElement | null => {
  if (typeof window === "undefined") return null;
  if (!bg) {
    bg = new Audio();
    bg.preload = "auto";
    bg.loop = true;
  }
  return bg;
};

const startBackground = (url: string, volume: number) => {
  const el = bgElement();
  if (!el) return;
  el.volume = clamp(volume);
  const play = () => void el.play().catch(() => {});
  if (unlocked) play();
  else pendingStart = play;
};

/**
 * Apply the Game's background choice. Called as often as the Game likes: the
 * same sound at the same volume keeps playing untouched.
 */
export const applyBackgroundSound = (slot: (SoundSlot & { enabled?: boolean }) | null): void => {
  const path = slot?.enabled === false ? null : slot?.ref?.path ?? null;
  if (!path) {
    stopBackgroundSound();
    return;
  }
  const volume = clamp(slot?.volume ?? 0.4);
  if (bgPath === path) {
    const el = bgElement();
    if (el) {
      el.volume = volume;
      if (el.paused) {
        const play = () => void el.play().catch(() => {});
        if (unlocked) play();
        else pendingStart = play;
      }
    }
    return;
  }
  bgPath = path;
  const known = urlFor(path);
  if (known) {
    const el = bgElement();
    if (el) el.src = known;
    startBackground(known, volume);
    return;
  }
  void prepareSound(path).then((url) => {
    // a later choice already won
    if (!url || bgPath !== path) return;
    const el = bgElement();
    if (!el) return;
    el.src = url;
    startBackground(url, volume);
  });
};

export const setBackgroundVolume = (volume: number): void => {
  if (bg) bg.volume = clamp(volume);
};

export const stopBackgroundSound = (): void => {
  bgPath = null;
  pendingStart = null;
  if (!bg) return;
  bg.pause();
  try {
    bg.currentTime = 0;
  } catch {
    /* some browsers refuse before any data has loaded */
  }
};

/* ── reward sounds: independent one-shots ───────────────────────────────── */

/** Resolve every chosen sound ahead of play so the first activation is instant. */
export const prepareGameSounds = (sound: GameSoundSettings | null | undefined): void => {
  if (!sound) return;
  const slots: (SoundSlot | undefined)[] = Object.values(sound.rewards ?? {});
  const paths = [
    sound.background?.ref?.path,
    ...slots.map((slot) => slot?.ref?.path),
  ].filter(Boolean) as string[];
  for (const path of paths) void prepareSound(path);
};

/**
 * Play one reward's own sound, at its own volume. Simultaneous activations each
 * get their own playback, so nothing is cut short and nothing queues.
 */
export const playRewardSound = (
  sound: GameSoundSettings | null | undefined,
  key: RewardSoundKey,
): void => {
  if (typeof window === "undefined") return;
  const slot = sound?.rewards?.[key];
  const path = slot?.ref?.path;
  if (!path) return;
  const volume = clamp(slot?.volume ?? 0.8);
  const fire = (url: string) => {
    const el = new Audio(url);
    el.volume = volume;
    void el.play().catch(() => {});
  };
  const known = urlFor(path);
  if (known) {
    fire(known);
    return;
  }
  void prepareSound(path).then((url) => {
    if (url) fire(url);
  });
};

/** Preview any single sound (used by the pickers). One preview at a time. */
let previewEl: HTMLAudioElement | null = null;

export const previewSound = (path: string, volume = 0.8): void => {
  if (typeof window === "undefined") return;
  stopPreview();
  void prepareSound(path).then((url) => {
    if (!url) return;
    const el = new Audio(url);
    el.volume = clamp(volume);
    previewEl = el;
    void el.play().catch(() => {});
  });
};

export const stopPreview = (): void => {
  if (!previewEl) return;
  previewEl.pause();
  previewEl = null;
};
