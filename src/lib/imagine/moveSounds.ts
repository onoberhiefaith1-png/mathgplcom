// Imagine move sounds: tiny cues synthesised in the browser for every student
// move. No files, fire-and-forget, shares the Game's mute switch, never awaits.
import { isMuted } from "@/lib/slate/audio";

export type MoveCue = "type" | "erase" | "step" | "correct" | "wrong" | "complete";

/** Correct-line streaks climb in pitch, capped so it never gets shrill. */
export const streakPitch = (streak: number) => 660 * Math.pow(1.122, Math.min(Math.max(0, streak - 1), 6));

/** Rapid typing never piles sounds up. */
export const TYPE_THROTTLE_MS = 40;

let ctx: AudioContext | null = null;
let volume = 0.8;
let lastType = 0;

export const setMoveVolume = (v: number) => { volume = Math.min(1, Math.max(0, v)); };

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function blip(c: AudioContext, type: OscillatorType, from: number, to: number, dur: number, gain: number, at = 0) {
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  if (to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * volume), t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.03);
}

export function playMove(cue: MoveCue, streak = 1) {
  if (isMuted() || volume <= 0) return;
  if (cue === "type") {
    const now = performance.now();
    if (now - lastType < TYPE_THROTTLE_MS) return;
    lastType = now;
  }
  const c = audio();
  if (!c) return;
  try {
    switch (cue) {
      case "type": blip(c, "sine", 1400 + Math.random() * 300, 1100, 0.05, 0.06); break;
      case "erase": blip(c, "triangle", 900, 300, 0.12, 0.05); break;
      case "step": blip(c, "sine", 523, 523, 0.14, 0.07); blip(c, "sine", 784, 784, 0.18, 0.06, 0.07); break;
      case "correct": {
        const f = streakPitch(streak);
        blip(c, "triangle", f, f * 1.5, 0.22, 0.1);
        blip(c, "sine", f * 2, f * 2, 0.3, 0.05, 0.08);
        break;
      }
      case "wrong": blip(c, "sine", 180, 110, 0.18, 0.08); break;
      case "complete": [523, 659, 784, 1047].forEach((f, i) => blip(c, "triangle", f, f, 0.28, 0.09, i * 0.09)); break;
    }
  } catch { /* audio must never break play */ }
}
