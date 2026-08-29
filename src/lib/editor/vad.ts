import { TARGET_RATE } from "./audio";

export interface SpeechRun {
  start: number;
  end: number;
}

const FRAME_MS = 25;
const MIN_SPEECH = 0.2;
const MIN_SILENCE = 0.25;

/**
 * Energy-based voice-activity detection over mono samples.
 * Produces the speech runs of the ORIGINAL audio so the engine knows how long
 * the teacher actually spoke inside any window (as opposed to how long the
 * window itself is).
 */
export function detectSpeech(samples: Float32Array, rate = TARGET_RATE): SpeechRun[] {
  if (samples.length === 0) return [];
  const frame = Math.max(1, Math.floor((FRAME_MS / 1000) * rate));
  const count = Math.floor(samples.length / frame);
  if (count === 0) return [];

  const energy = new Float32Array(count);
  for (let f = 0; f < count; f++) {
    let sum = 0;
    const from = f * frame;
    for (let i = from; i < from + frame; i++) {
      const v = samples[i] ?? 0;
      sum += v * v;
    }
    energy[f] = Math.sqrt(sum / frame);
  }

  // Adaptive noise floor: the 20th percentile of frame energy.
  const sorted = Array.from(energy).sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.2)] ?? 0;
  const peak = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  if (peak <= 0) return [];
  const openAt = Math.max(floor * 2.5, floor + (peak - floor) * 0.18, peak * 0.06);
  const closeAt = openAt * 0.6;

  const runs: SpeechRun[] = [];
  let speaking = false;
  let startFrame = 0;
  for (let f = 0; f < count; f++) {
    const level = energy[f] ?? 0;
    if (!speaking && level >= openAt) {
      speaking = true;
      startFrame = f;
    } else if (speaking && level < closeAt) {
      speaking = false;
      runs.push({ start: (startFrame * frame) / rate, end: (f * frame) / rate });
    }
  }
  if (speaking) runs.push({ start: (startFrame * frame) / rate, end: (count * frame) / rate });

  // Merge runs separated by a very short gap, then drop very short runs.
  const merged: SpeechRun[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && run.start - last.end < MIN_SILENCE) last.end = run.end;
    else merged.push({ ...run });
  }
  return merged.filter((run) => run.end - run.start >= MIN_SPEECH);
}

/** Speech runs clipped to a window, in order. */
export function runsInWindow(runs: SpeechRun[], start: number, end: number): SpeechRun[] {
  const out: SpeechRun[] = [];
  for (const run of runs) {
    const from = Math.max(run.start, start);
    const to = Math.min(run.end, end);
    if (to > from) out.push({ start: from, end: to });
  }
  return out;
}

/** Total spoken seconds inside a window (silence excluded). */
export function speechDurationIn(runs: SpeechRun[], start: number, end: number): number {
  return runsInWindow(runs, start, end).reduce((sum, r) => sum + (r.end - r.start), 0);
}
