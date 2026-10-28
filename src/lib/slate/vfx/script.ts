// Hidden Effect Code.
//
// A teacher types a few plain commands against one reward. Nothing is ever
// executed as code: the text is tokenised into a small, closed command set and
// compiled into a timeline of states the effect stage interpolates between.
//
//   REVEAL 2x, +1, 7
//   ARRANGE row
//   MOVE up
//   ROTATE 180
//   SCALE 1.4
//   GLOW 1.2
//   WAIT 0.6
//   HIDE

import { clamp01, easeInOut, easeOut, type Easing } from "./stages";

export type Arrangement = "row" | "arc" | "ring" | "stack";

export const SCRIPT_HINT = "REVEAL a, b · ARRANGE row|arc|ring|stack · MOVE up|down|left|right|out · ROTATE 180 · SCALE 1.4 · GLOW 1.2 · WAIT 0.6 · HIDE";

export interface ScriptState {
  /** 0..1 emergence of the items. */
  reveal: number;
  arrange: Arrangement;
  dx: number;
  dy: number;
  rotation: number;
  scale: number;
  glow: number;
  opacity: number;
}

export interface ScriptSegment {
  start: number;
  end: number;
  from: ScriptState;
  to: ScriptState;
  ease: Easing;
}

export interface CompiledScript {
  tokens: string[];
  segments: ScriptSegment[];
  duration: number;
}

const BASE: ScriptState = {
  reveal: 0,
  arrange: "row",
  dx: 0,
  dy: 0,
  rotation: 0,
  scale: 1,
  glow: 1,
  opacity: 0,
};

const ARRANGEMENTS: Arrangement[] = ["row", "arc", "ring", "stack"];

const MOVES: Record<string, { dx: number; dy: number }> = {
  up: { dx: 0, dy: 0.5 },
  down: { dx: 0, dy: -0.5 },
  left: { dx: -0.55, dy: 0 },
  right: { dx: 0.55, dy: 0 },
  out: { dx: 0, dy: 0 },
};

const num = (raw: string | undefined, fallback: number) => {
  const value = Number.parseFloat((raw ?? "").replace(",", "."));
  return Number.isFinite(value) ? value : fallback;
};

/** Splits "2x, +1, 7" into readable items, capped so a paste cannot flood the room. */
const items = (raw: string) =>
  raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 12);

/**
 * Turns effect code into a timeline. Unknown or malformed lines are ignored
 * quietly, so a half-typed script never breaks the game.
 */
export function compileScript(source: string | undefined): CompiledScript | null {
  const text = (source ?? "").trim();
  if (!text) return null;

  const tokens: string[] = [];
  const segments: ScriptSegment[] = [];
  let state: ScriptState = { ...BASE };
  let cursor = 0;
  let revealed = false;
  let hidden = false;

  const step = (duration: number, patch: Partial<ScriptState>, ease: Easing = easeInOut) => {
    const from = state;
    const to = { ...state, ...patch };
    segments.push({ start: cursor, end: cursor + duration, from, to, ease });
    cursor += duration;
    state = to;
  };

  for (const line of text.split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean || clean.startsWith("//") || clean.startsWith("#")) continue;
    const space = clean.indexOf(" ");
    const verb = (space === -1 ? clean : clean.slice(0, space)).toUpperCase();
    const rest = space === -1 ? "" : clean.slice(space + 1).trim();

    switch (verb) {
      case "REVEAL": {
        const found = items(rest);
        if (!found.length) break;
        tokens.push(...found);
        revealed = true;
        hidden = false;
        step(0.4 + found.length * 0.06, { reveal: 1, opacity: 1 }, easeOut);
        break;
      }
      case "ARRANGE": {
        const mode = rest.toLowerCase() as Arrangement;
        if (!ARRANGEMENTS.includes(mode)) break;
        step(0.6, { arrange: mode });
        break;
      }
      case "MOVE": {
        const move = MOVES[rest.toLowerCase()];
        if (!move) break;
        step(0.8, { dx: state.dx + move.dx, dy: state.dy + move.dy });
        break;
      }
      case "ROTATE":
        step(0.5, { rotation: state.rotation + num(rest, 180) });
        break;
      case "SCALE":
        step(0.5, { scale: Math.min(3, Math.max(0.2, num(rest, 1))) });
        break;
      case "GLOW":
        step(0.4, { glow: Math.min(3, Math.max(0, num(rest, 1))) });
        break;
      case "WAIT":
        step(Math.min(5, Math.max(0.05, num(rest, 0.5))), {});
        break;
      case "HIDE":
        step(0.4, { opacity: 0, reveal: 0.6, scale: state.scale * 0.8 }, easeOut);
        hidden = true;
        break;
      default:
        break;
    }
  }

  if (!tokens.length || !revealed) return null;

  // every script settles, holds and then clears itself
  if (!hidden) {
    step(1, {});
    step(0.4, { opacity: 0, reveal: 0.6, scale: state.scale * 0.8 }, easeOut);
  }

  return { tokens, segments, duration: cursor };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The interpolated state at time t (seconds since the effect started). */
export function sampleScript(script: CompiledScript, t: number): ScriptState {
  const first = script.segments[0];
  if (!first) return { ...BASE };
  if (t <= 0) return first.from;
  const last = script.segments[script.segments.length - 1];
  if (last && t >= last.end) return last.to;

  const segment =
    script.segments.find((s) => t >= s.start && t < s.end) ?? last ?? first;
  const k = segment.ease(clamp01((t - segment.start) / Math.max(0.0001, segment.end - segment.start)));
  return {
    reveal: lerp(segment.from.reveal, segment.to.reveal, k),
    arrange: k < 0.5 ? segment.from.arrange : segment.to.arrange,
    dx: lerp(segment.from.dx, segment.to.dx, k),
    dy: lerp(segment.from.dy, segment.to.dy, k),
    rotation: lerp(segment.from.rotation, segment.to.rotation, k),
    scale: lerp(segment.from.scale, segment.to.scale, k),
    glow: lerp(segment.from.glow, segment.to.glow, k),
    opacity: lerp(segment.from.opacity, segment.to.opacity, k),
  };
}

/** Resting position of item i inside the chosen arrangement. */
export function arrangeAt(
  mode: Arrangement,
  index: number,
  count: number,
  spread: number,
): [number, number] {
  const half = (count - 1) / 2;
  switch (mode) {
    case "stack":
      return [0, (half - index) * spread * 0.62];
    case "arc": {
      const a = ((index - half) / Math.max(1, half)) * 0.9;
      return [a * spread * half * 1.1, Math.cos(a) * spread * 0.5 - spread * 0.3];
    }
    case "ring": {
      const a = (index / Math.max(1, count)) * Math.PI * 2;
      const r = spread * Math.max(0.7, count * 0.16);
      return [Math.cos(a) * r, Math.sin(a) * r];
    }
    case "row":
    default:
      return [(index - half) * spread, 0];
  }
}
