import { TARGET_RATE, buildPeaks, encodeWav } from "./audio";

/** Generates speech for a single script segment (text only leaves the browser). */
export async function speakSegment(
  text: string,
  voice: string,
  instructions: string,
): Promise<Blob> {
  const response = await fetch("/api/course-edit/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice, instructions }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Voice generation failed (${response.status})`);
  }
  return await response.blob();
}

function audioCtor(): typeof AudioContext | undefined {
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

/** Decodes any audio blob to mono samples at the editor's working rate. */
export async function decodeToMono(blob: Blob): Promise<Float32Array> {
  const Ctor = audioCtor();
  if (!Ctor) throw new Error("This browser cannot decode audio");
  const ctx = new Ctor();
  try {
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    const source = buffer.getChannelData(0);
    if (buffer.sampleRate === TARGET_RATE) return source.slice();
    const ratio = buffer.sampleRate / TARGET_RATE;
    const out = new Float32Array(Math.floor(source.length / ratio));
    for (let i = 0; i < out.length; i++) {
      const pos = i * ratio;
      const idx = Math.floor(pos);
      const a = source[idx] ?? 0;
      const b = source[idx + 1] ?? a;
      out[i] = a + (b - a) * (pos - idx);
    }
    return out;
  } finally {
    void ctx.close();
  }
}

/** Speeds up or slows down samples so a clip fits its window. */
export function applySpeed(samples: Float32Array, speed: number): Float32Array {
  if (!Number.isFinite(speed) || Math.abs(speed - 1) < 0.001) return samples;
  const factor = Math.min(Math.max(speed, 0.5), 3);
  const out = new Float32Array(Math.max(1, Math.floor(samples.length / factor)));
  for (let i = 0; i < out.length; i++) {
    const pos = i * factor;
    const idx = Math.floor(pos);
    const a = samples[idx] ?? 0;
    const b = samples[idx + 1] ?? a;
    out[i] = a + (b - a) * (pos - idx);
  }
  return out;
}

export interface PlacedClip {
  start: number;
  samples: Float32Array;
  /** hard container end — the clip may never write past it */
  containerEnd?: number;
}

export interface MixSettings {
  /** generated voice level, 0-2 */
  voiceVolume: number;
  /** keep the original audio underneath as a background bed */
  keepOriginal: boolean;
  /** original bed level, 0-1 */
  originalVolume: number;
  /** lower the bed inside speech windows so the new voice stays clear */
  duck: boolean;
}

export const DEFAULT_MIX: MixSettings = {
  voiceVolume: 1,
  keepOriginal: false,
  originalVolume: 0.25,
  duck: true,
};

/**
 * Mixes every generated clip onto the timeline, optionally over the original
 * audio used as a background bed, with ducking inside the speech windows.
 */
export function buildGeneratedTrack(
  clips: PlacedClip[],
  duration: number,
  mix: MixSettings = DEFAULT_MIX,
  bed: Float32Array | null = null,
): { blob: Blob; duration: number; peaks: number[] } {
  const length = Math.max(1, Math.ceil(duration * TARGET_RATE));
  const track = new Float32Array(length);

  if (mix.keepOriginal && bed) {
    // Gain envelope: full bed level, ducked down inside each speech window.
    const gain = new Float32Array(length).fill(1);
    if (mix.duck) {
      const fade = Math.floor(0.12 * TARGET_RATE);
      const ducked = 0.25;
      for (const clip of clips) {
        const from = Math.max(0, Math.floor(clip.start * TARGET_RATE));
        const to = Math.min(length, from + clip.samples.length);
        for (let i = from; i < to; i++) gain[i] = ducked;
        for (let i = 0; i < fade; i++) {
          const before = from - fade + i;
          if (before >= 0 && before < length) {
            gain[before] = Math.min(gain[before] ?? 1, 1 - (1 - ducked) * (i / fade));
          }
          const after = to + i;
          if (after >= 0 && after < length) {
            gain[after] = Math.min(gain[after] ?? 1, ducked + (1 - ducked) * (i / fade));
          }
        }
      }
    }
    for (let i = 0; i < length; i++) {
      track[i] = (bed[i] ?? 0) * mix.originalVolume * (gain[i] ?? 1);
    }
  }

  for (const clip of clips) {
    const offset = Math.max(0, Math.floor(clip.start * TARGET_RATE));
    const limit =
      clip.containerEnd !== undefined
        ? Math.min(length, Math.ceil(clip.containerEnd * TARGET_RATE))
        : length;
    for (let i = 0; i < clip.samples.length; i++) {
      const target = offset + i;
      if (target >= limit) break;
      const mixed = (track[target] ?? 0) + (clip.samples[i] ?? 0) * mix.voiceVolume;
      track[target] = Math.max(-1, Math.min(1, mixed));
    }
  }

  return {
    blob: encodeWav(track, TARGET_RATE),
    duration: length / TARGET_RATE,
    peaks: buildPeaks(track),
  };
}
