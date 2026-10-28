import { makeId } from "./types";
import type { SpeechRun } from "./vad";
import { runsInWindow } from "./vad";
import type { TranscriptSegment } from "./workflow";

/**
 * LANGUAGE FIRST: sentence and clause boundaries decide where a synchronization
 * unit begins and ends. There is no fixed 4/5/6/10-second box anywhere here.
 */
export function splitIntoUnits(text: string, maxChars = 220): string[] {
  const sentences = (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text])
    .map((s) => s.trim())
    .filter(Boolean);

  const units: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= maxChars) {
      units.push(sentence);
      continue;
    }
    units.push(...splitAtClauses(sentence, maxChars));
  }
  return units;
}

/** Only ever splits at a comma / natural clause boundary — never mid-phrase. */
function splitAtClauses(sentence: string, maxChars: number): string[] {
  const pieces = sentence.match(/[^,;:]+[,;:]?\s*/g) ?? [sentence];
  const out: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (current && (current + piece).trim().length > maxChars) {
      out.push(current.trim());
      current = piece;
    } else {
      current += piece;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out.length > 0 ? out : [sentence];
}

/** Maps a position measured in spoken seconds back to wall-clock time. */
function clockAtSpeechTime(runs: SpeechRun[], spoken: number, fallbackEnd: number): number {
  let remaining = spoken;
  for (const run of runs) {
    const length = run.end - run.start;
    if (remaining <= length) return run.start + remaining;
    remaining -= length;
  }
  const last = runs[runs.length - 1];
  return last ? last.end : fallbackEnd;
}

/**
 * Aligns linguistic units to the ACTUAL speech runs of the original audio.
 * Containers stay contiguous and glued to the original timeline, so the next
 * unit always starts exactly where it started in the original video.
 */
export function alignUnits(
  units: string[],
  windowStart: number,
  windowEnd: number,
  speechRuns: SpeechRun[],
): TranscriptSegment[] {
  if (units.length === 0) return [];
  const runs = runsInWindow(speechRuns, windowStart, windowEnd);
  const spokenTotal = runs.reduce((sum, r) => sum + (r.end - r.start), 0);
  const weights = units.map((u) => Math.max(u.replace(/\s+/g, "").length, 1));
  const weightTotal = weights.reduce((a, b) => a + b, 0);

  // No usable speech map: fall back to a proportional spread of the window.
  const usable = spokenTotal > 0.2 && runs.length > 0;
  const span = Math.max(windowEnd - windowStart, 0.1);

  const spans = units.map((text, i) => {
    const share = ((weights[i] ?? 1) / weightTotal) * (usable ? spokenTotal : span);
    return { text, share };
  });

  let cumulative = 0;
  const raw = spans.map(({ text, share }) => {
    const speechStart = usable
      ? clockAtSpeechTime(runs, cumulative, windowEnd)
      : windowStart + cumulative;
    cumulative += share;
    const speechEnd = usable
      ? clockAtSpeechTime(runs, cumulative, windowEnd)
      : windowStart + cumulative;
    return { text, speechStart, speechEnd, speechDuration: share };
  });

  return raw.map((unit, i) => {
    const next = raw[i + 1];
    // Containers are contiguous: each one runs from this unit's speech onset to
    // the next unit's speech onset, so silence stays inside the unit before it
    // and the next unit always begins at its original timeline position.
    const containerStart = i === 0 ? windowStart : unit.speechStart;
    const containerEnd = next ? Math.max(next.speechStart, unit.speechEnd) : windowEnd;
    const segment: TranscriptSegment = {
      id: makeId(),
      start: containerStart,
      end: Math.max(containerEnd, containerStart + 0.1),
      text: unit.text,
      speechStart: unit.speechStart,
      speechEnd: Math.max(unit.speechEnd, unit.speechStart + 0.05),
      speechDuration: Math.max(unit.speechDuration, 0.05),
    };
    return segment;
  });
}
