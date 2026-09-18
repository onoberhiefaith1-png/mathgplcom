// Activation choreography: how the reward OBJECT itself behaves while its
// effect runs. The effect is born from the object and travels with it, so
// both are driven from one description per reward.
//
// DORMANT -> REVEAL -> ANTICIPATION -> TRANSFORMATION -> EFFECT -> RESOLUTION

import { clamp01, easeIn, easeOut } from "./stages";

export type ProfileId =
  | "core"
  | "chain-bomb"
  | "sweep-horizontal"
  | "sweep-vertical"
  | "vault"
  | "heart"
  | "shard"
  | "seal";

export interface Choreography {
  /** Total lifetime of the activation, in seconds at speed 1. */
  duration: number;
  /** Blurred -> sharp. */
  reveal: number;
  /** Charging: pulse, compress, brighten. */
  anticipation: number;
  /** The object's own transformation ends here (launch / detonation). */
  transform: number;
  /** Peak spin, radians per second. */
  spin: number;
  /** Peak scale reached while transforming. */
  grow: number;
  /** Object travel, in slate units, during the effect. */
  travel: { axis: "x" | "y"; span: number } | null;
  /** The body breaks apart at `transform` instead of resolving. */
  fragment: boolean;
  /** Colour of the light this object throws onto the surface. */
  light: string;
  /** Speed personality, for reference in the UI. */
  tempo: "fast" | "medium" | "slow";
}

const CHOREOGRAPHY: Record<ProfileId, Choreography> = {
  core: {
    duration: 5.8,
    reveal: 0.42,
    anticipation: 0.95,
    transform: 3,
    spin: 18,
    grow: 3.45,
    travel: null,
    fragment: true,
    light: "#ff7a18",
    tempo: "fast",
  },
  "chain-bomb": {
    duration: 7.8,
    reveal: 0.5,
    anticipation: 1.15,
    transform: 3.05,
    spin: 0,
    grow: 1.6,
    travel: null,
    fragment: true,
    light: "#ffe56b",
    tempo: "fast",
  },
  "sweep-horizontal": {
    duration: 1.9,
    reveal: 0.16,
    anticipation: 0.42,
    transform: 1.45,
    // the collector holds its facing: a sweep reads badly if the body tumbles
    spin: 0,
    grow: 1.3,
    travel: { axis: "x", span: 4.4 },
    fragment: false,
    light: "#7fd4ff",
    tempo: "fast",
  },
  "sweep-vertical": {
    duration: 1.9,
    reveal: 0.16,
    anticipation: 0.42,
    transform: 1.45,
    spin: 0,
    grow: 1.3,
    travel: { axis: "y", span: 2.6 },
    fragment: false,
    light: "#7fffe4",
    tempo: "fast",
  },

  vault: {
    duration: 2.2,
    reveal: 0.3,
    anticipation: 0.6,
    transform: 1.5,
    spin: 0,
    grow: 1.34,
    travel: null,
    fragment: false,
    light: "#4ea8ff",
    tempo: "medium",
  },
  heart: {
    duration: 1.3,
    reveal: 0.22,
    anticipation: 0.5,
    transform: 1.1,
    spin: 0,
    grow: 1.3,
    travel: null,
    fragment: false,
    light: "#ff5470",
    tempo: "medium",
  },
  seal: {
    duration: 1.3,
    reveal: 0.22,
    anticipation: 0.5,
    transform: 1.1,
    spin: 2.6,
    grow: 1.24,
    travel: null,
    fragment: false,
    light: "#ffc857",
    tempo: "medium",
  },
  shard: {
    // the hourglass is deliberately slower and more elegant
    duration: 2.4,
    reveal: 0.4,
    anticipation: 1,
    transform: 1.9,
    spin: 3.2,
    grow: 1.22,
    travel: null,
    fragment: false,
    light: "#54d8ff",
    tempo: "slow",
  },
};

export const choreography = (profile: string): Choreography =>
  CHOREOGRAPHY[profile as ProfileId] ?? CHOREOGRAPHY.heart;

export interface ObjectMotion {
  /** 0 = dormant and faint, 1 = fully solid. */
  clarity: number;
  scale: number;
  /** Absolute rotation in radians. */
  spin: number;
  /** Local travel offset, in slate units. */
  x: number;
  y: number;
  /** False only once the body has broken apart. */
  visible: boolean;
  /** Brightness of the light the object throws, 0..1. */
  emission: number;
}

/** How deeply a fragmenting body squeezes inward just before it bursts. */
const COMPRESS_DEPTH = 0.16;

/**
 * Pressure steps rather than a straight ramp: the body holds, jumps, holds,
 * jumps, so the growth reads as something building inside it.
 */
const steppedGrow = (k: number) => {
  const stops = [0, 0.16, 0.38, 0.68, 1];
  const span = 1 / (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(clamp01(k) / span));
  const from = stops[index] ?? 0;
  const to = stops[index + 1] ?? 1;
  const local = easeOut((clamp01(k) - index * span) / span);
  return from + (to - from) * local;
};

/** 0 everywhere except a short inward dip across the final 12% of the charge. */
const compressDip = (k: number) => {
  const start = 0.88;
  if (k < start) return 0;
  return Math.sin(((clamp01(k) - start) / (1 - start)) * Math.PI);
};

/**
 * The object's own state at time `t` of its activation. This is the single
 * source of truth for "the reward is the actor inside its effect".
 */

export const objectMotion = (c: Choreography, t: number, direction = 1): ObjectMotion => {
  const reveal = clamp01(t / Math.max(0.0001, c.reveal));
  const anticipation = clamp01((t - c.reveal) / Math.max(0.0001, c.anticipation - c.reveal));
  const transform = clamp01((t - c.anticipation) / Math.max(0.0001, c.transform - c.anticipation));
  const after = clamp01((t - c.transform) / Math.max(0.0001, c.duration - c.transform));

  // reveal: blurred -> sharp. anticipation: a compressing pulse.
  const pulse = 1 - Math.sin(anticipation * Math.PI * 3) * 0.08 * anticipation;
  // transformation: the body swells in pressure steps rather than linearly,
  // 100 -> 110 -> 125 -> 145 -> 165 %, then squeezes inward at the very peak
  const stepped = steppedGrow(transform);
  const compress = c.fragment ? 1 - COMPRESS_DEPTH * compressDip(transform) : 1;
  const grow = (1 + (c.grow - 1) * stepped) * compress;
  // resolution: fragments leave, the shell does not linger. The parent holds
  // its peak size so the body-to-fragment handoff never snaps spatially.
  const settle = c.fragment ? 1 : 1 - 0.55 * easeOut(after);

  let x = 0;
  let y = 0;
  if (c.travel) {
    const k = easeIn(transform);
    const dist = c.travel.span * k * direction;
    if (c.travel.axis === "x") x = dist;
    else y = dist;
  }


  return {
    clarity: easeOut(reveal),
    scale: (0.82 + 0.18 * easeOut(reveal)) * pulse * grow * settle,
    spin: c.fragment
      ? c.spin * (0.08 * anticipation + 0.5 * easeIn(transform)) * Math.min(t, c.transform)
      : c.spin * (0.5 * anticipation + easeIn(transform) * 1.5) * t,
    x,
    y,
    visible: !(c.fragment && t >= c.transform),
    // the object's own light builds through the charge and fades as it resolves
    emission:
      (0.25 * easeOut(reveal) + 0.35 * anticipation + 0.4 * transform) *
      (t < c.transform ? 1 : Math.max(0, 1 - after * 2.5)),
  };
};
