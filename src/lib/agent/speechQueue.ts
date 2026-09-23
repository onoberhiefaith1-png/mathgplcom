// Aura's voice during a call: a queue that runs ahead of what is being heard.
//
// Each clause is fetched the instant it exists, while the previous one is still
// playing, and everything is scheduled on one continuous playhead on the shared
// audio device. That is what removes the seam between sentences. A barge-in
// empties the queue and stops the sound mid-word.

import { fetchSpeechChunks } from "@/components/agent/streamSpeech";
import { SPEECH_SAMPLE_RATE, unlockSharedAudio } from "@/components/agent/sharedAudio";

/** How loud a block of her own voice is, so barge-in can ignore it. */
function loudness(samples: Float32Array<ArrayBuffer>): number {
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index] ?? 0;
    sum += sample * sample;
  }
  return Math.min(1, Math.sqrt(sum / Math.max(1, samples.length)) * 6);
}

type Piece = {
  text: string;
  chunks: Float32Array<ArrayBuffer>[];
  done: boolean;
  failed: boolean;
  wake: (() => void) | null;
  controller: AbortController;
};

export type SpeechQueueOptions = {
  /** Called when her voice starts, and again when the queue has run dry. */
  onSpeaking?: (speaking: boolean) => void;
  /** Called when a piece could not be fetched, so a fallback voice can speak. */
  onFailed?: (text: string) => void;
};

export class SpeechQueue {
  private pieces: Piece[] = [];
  private draining = false;
  private playhead = 0;
  private live = new Set<AudioBufferSourceNode>();
  /** Her own output level over time, so she never interrupts herself. */
  private envelope: { from: number; to: number; level: number }[] = [];
  private speaking = false;
  private options: SpeechQueueOptions;

  constructor(options: SpeechQueueOptions = {}) {
    this.options = options;
  }

  /** Opened on the tap that starts the call, so phones allow sound later. */
  async unlock(): Promise<boolean> {
    return (await unlockSharedAudio()) !== null;
  }

  /** Add one clause. Its audio is fetched immediately, ahead of playback. */
  say(text: string): void {
    const said = text.trim();
    if (!said) return;
    const piece: Piece = {
      text: said,
      chunks: [],
      done: false,
      failed: false,
      wake: null,
      controller: new AbortController(),
    };
    this.pieces.push(piece);
    void fetchSpeechChunks(
      said,
      (samples) => {
        piece.chunks.push(samples);
        piece.wake?.();
      },
      piece.controller.signal,
    )
      .catch(() => {
        if (!piece.controller.signal.aborted) piece.failed = true;
      })
      .finally(() => {
        piece.done = true;
        piece.wake?.();
      });
    void this.drain();
  }

  /** True while her voice is playing or about to. */
  get active(): boolean {
    return this.speaking || this.pieces.length > 0;
  }

  /** How loud she is right now, 0 to 1 — barge-in compares against this. */
  outputLevel(): number {
    const context = this.context();
    if (!context) return 0;
    const now = context.currentTime;
    this.envelope = this.envelope.filter((span) => span.to > now - 0.5);
    let level = 0;
    for (const span of this.envelope) {
      if (now >= span.from && now <= span.to) level = Math.max(level, span.level);
    }
    return level;
  }

  /** Stop instantly and forget everything queued: someone is talking over her. */
  flush(): void {
    for (const piece of this.pieces) piece.controller.abort();
    this.pieces = [];
    for (const source of this.live) {
      try {
        source.onended = null;
        source.stop();
      } catch {
        /* already finished */
      }
    }
    this.live.clear();
    this.envelope = [];
    this.playhead = 0;
    this.setSpeaking(false);
  }

  /** End of the call. */
  close(): void {
    this.flush();
  }

  private cached: AudioContext | null = null;

  private context() {
    return this.cached;
  }

  private setSpeaking(next: boolean) {
    if (this.speaking === next) return;
    this.speaking = next;
    this.options.onSpeaking?.(next);
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      const context = await unlockSharedAudio();
      if (!context) return;
      this.cached = context;

      while (this.pieces.length > 0) {
        const piece = this.pieces[0]!;
        while (true) {
          if (piece.controller.signal.aborted) break;
          const chunk = piece.chunks.shift();
          if (chunk) {
            this.schedule(context, chunk);
            continue;
          }
          if (piece.done) break;
          await new Promise<void>((resolve) => {
            piece.wake = () => {
              piece.wake = null;
              resolve();
            };
          });
        }
        if (piece.failed && !piece.controller.signal.aborted) this.options.onFailed?.(piece.text);
        if (this.pieces[0] === piece) this.pieces.shift();
      }
    } finally {
      this.draining = false;
      // Her voice ends when the last scheduled sound has been heard.
      if (this.pieces.length === 0 && this.live.size === 0) this.setSpeaking(false);
    }
  }

  private schedule(context: AudioContext, samples: Float32Array<ArrayBuffer>) {
    const buffer = context.createBuffer(1, samples.length, SPEECH_SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    // A small lead-in: audio scheduled exactly at currentTime clips on phones.
    const at = Math.max(this.playhead, context.currentTime + 0.06);
    this.playhead = at + buffer.duration;
    this.envelope.push({ from: at, to: this.playhead, level: loudness(samples) });
    this.live.add(source);
    this.setSpeaking(true);
    source.onended = () => {
      this.live.delete(source);
      if (this.pieces.length === 0 && this.live.size === 0) this.setSpeaking(false);
    };
    source.start(at);
  }
}

/**
 * Her reply cut at natural speaking boundaries. A clause is enough to start
 * talking, so the first sound comes far sooner than a full sentence would allow.
 */
export function takeClauses(buffer: string, flush = false): { clauses: string[]; rest: string } {
  const clauses: string[] = [];
  let rest = buffer;
  const MIN = 18;

  while (true) {
    const text = rest;
    let cut = -1;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index]!;
      const sentenceEnd = character === "." || character === "!" || character === "?" || character === "…";
      const clauseEnd = character === "," || character === ";" || character === ":" || character === "\n";
      if (!sentenceEnd && !clauseEnd) continue;
      // A decimal point or an abbreviation is not the end of anything.
      if (sentenceEnd && /\d/.test(text[index - 1] ?? "") && /\d/.test(text[index + 1] ?? "")) continue;
      if (index + 1 < text.length && !/[\s\n]/.test(text[index + 1] ?? "")) continue;
      if (index + 1 >= MIN) {
        cut = index + 1;
        break;
      }
    }
    if (cut === -1) break;
    const piece = text.slice(0, cut).trim();
    rest = text.slice(cut);
    if (piece) clauses.push(piece);
  }

  if (flush) {
    const remainder = rest.trim();
    if (remainder) clauses.push(remainder);
    rest = "";
  }
  return { clauses, rest };
}
