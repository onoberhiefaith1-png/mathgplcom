import type { Clip } from "./types";

export const TARGET_RATE = 16000;

export interface ExtractedAudio {
  blob: Blob;
  duration: number;
  peaks: number[];
  /** mono samples at TARGET_RATE, kept for chunked transcription */
  samples: Float32Array;
}

function audioCtor(): typeof AudioContext | undefined {
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

/**
 * Decodes the source file's audio track in the browser and renders ONLY the
 * edited clip ranges, in order, into a single mono 16 kHz asset.
 * The video itself is never uploaded anywhere.
 */
export async function extractEditedAudio(
  file: File,
  clips: Clip[],
  onProgress?: (message: string) => void,
): Promise<ExtractedAudio> {
  const Ctor = audioCtor();
  if (!Ctor) throw new Error("This browser cannot decode audio");
  onProgress?.("Decoding the original audio track…");
  const ctx = new Ctor();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    void ctx.close();
    throw new Error("This file's audio track could not be decoded in the browser");
  }
  void ctx.close();

  onProgress?.("Rendering the edited audio timeline…");
  const rate = decoded.sampleRate;
  const channel = decoded.getChannelData(0);
  const second = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : null;

  const pieces: Float32Array[] = [];
  let total = 0;
  for (const clip of clips) {
    const from = Math.max(0, Math.floor(clip.sourceStart * rate));
    const to = Math.min(channel.length, Math.ceil(clip.sourceEnd * rate));
    if (to <= from) continue;
    const length = to - from;
    const piece = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const a = channel[from + i] ?? 0;
      const b = second ? (second[from + i] ?? 0) : a;
      piece[i] = (a + b) / 2;
    }
    pieces.push(piece);
    total += length;
  }

  const merged = new Float32Array(total);
  let offset = 0;
  for (const piece of pieces) {
    merged.set(piece, offset);
    offset += piece.length;
  }

  const samples = resample(merged, rate, TARGET_RATE);
  const duration = samples.length / TARGET_RATE;
  onProgress?.("Encoding the extracted audio…");
  const blob = encodeWav(samples, TARGET_RATE);
  return { blob, duration, peaks: buildPeaks(samples), samples };
}

function resample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const length = Math.floor(input.length / ratio);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = input[idx] ?? 0;
    const b = input[idx + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

export function buildPeaks(samples: Float32Array, buckets = 1600): number[] {
  if (samples.length === 0) return [];
  const step = Math.max(1, Math.floor(samples.length / buckets));
  const peaks: number[] = [];
  for (let i = 0; i < buckets; i++) {
    let peak = 0;
    const start = i * step;
    for (let j = start; j < start + step && j < samples.length; j += 4) {
      const v = Math.abs(samples[j] ?? 0);
      if (v > peak) peak = v;
    }
    peaks.push(peak);
  }
  const max = Math.max(...peaks, 0.0001);
  return peaks.map((p) => p / max);
}

export function encodeWav(samples: Float32Array, rate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export interface AudioChunk {
  start: number;
  end: number;
  blob: Blob;
}

/** Split the extracted audio into complete WAV files the model can accept. */
export function chunkAudio(samples: Float32Array, seconds = 120): AudioChunk[] {
  const size = seconds * TARGET_RATE;
  const chunks: AudioChunk[] = [];
  for (let offset = 0; offset < samples.length; offset += size) {
    const slice = samples.slice(offset, Math.min(offset + size, samples.length));
    if (slice.length < TARGET_RATE * 0.2) break;
    chunks.push({
      start: offset / TARGET_RATE,
      end: (offset + slice.length) / TARGET_RATE,
      blob: encodeWav(slice, TARGET_RATE),
    });
  }
  return chunks;
}
