import type { EffectMotion, EffectPlayback, EffectTrigger, LayoutItem } from "./types";

export const DEFAULT_MOTION: EffectMotion = { type: "static", speed: 1, amplitude: 10 };
export const DEFAULT_PLAYBACK: EffectPlayback = {
  direction: "forward", speed: 1, loopMode: "forever", freezeLastFrame: false,
};
export const DEFAULT_TRIGGER: EffectTrigger = {
  start: "always", delay: 0, exitBehavior: "instant",
};

export function withEffectDefaults(it: LayoutItem): Required<
  Pick<LayoutItem, "rotation" | "opacity" | "zIndex" | "blendMode">
> & {
  motion: EffectMotion; playback: EffectPlayback; trigger: EffectTrigger;
} {
  return {
    rotation: it.rotation ?? 0,
    opacity: it.opacity ?? 1,
    zIndex: it.zIndex ?? 1,
    blendMode: it.blendMode ?? "screen",
    motion: { ...DEFAULT_MOTION, ...(it.motion ?? {}) },
    playback: { ...DEFAULT_PLAYBACK, ...(it.playback ?? {}) },
    trigger: { ...DEFAULT_TRIGGER, ...(it.trigger ?? {}) },
  };
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
