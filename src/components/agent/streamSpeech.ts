// Aura's voice in the browser, chunk by chunk, so she starts speaking as soon
// as the first audio arrives.
//
// The audio device is shared and long-lived (see sharedAudio.ts): opening and
// closing one per sentence is what clipped her first words on phones.

import { createParser } from "eventsource-parser";

import { SPEECH_SAMPLE_RATE, sharedAudioContext, unlockSharedAudio } from "./sharedAudio";

const SPEECH_ENDPOINT = "/api/aura-speech";

function decodePCM(pending: Uint8Array, incoming: Uint8Array) {
  const bytes = new Uint8Array(pending.length + incoming.length);
  bytes.set(pending);
  bytes.set(incoming, pending.length);
  const usable = bytes.length - (bytes.length % 2);
  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(usable / 2);
  for (let i = 0; i < samples.length; i += 1) samples[i] = view.getInt16(i * 2, true) / 32768;
  return { samples, pending: bytes.slice(usable) };
}

/**
 * Fetches one piece of speech and hands over each decoded block of sound the
 * moment it arrives. Nothing is played here — the caller schedules it, so many
 * pieces can be fetched ahead of the one being heard.
 */
export async function fetchSpeechChunks(
  text: string,
  onChunk: (samples: Float32Array<ArrayBuffer>) => void,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  const response = await fetch(SPEECH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Speech failed: ${response.status} ${await response.text().catch(() => "")}`);
  }

  let pending = new Uint8Array(0);
  let completed = false;
  let heard = 0;

  const parser = createParser({
    onEvent(event) {
      const payload = JSON.parse(event.data) as { type?: string; audio?: string; error?: unknown };
      if (payload.type === "error" || payload.error) throw new Error(`Speech failed: ${event.data}`);
      if (payload.type === "speech.audio.done") {
        completed = true;
        return;
      }
      if (payload.type !== "speech.audio.delta") return;
      if (completed || !payload.audio) throw new Error("Invalid speech audio event");

      const decoded = decodePCM(
        pending,
        Uint8Array.from(atob(payload.audio), (character) => character.charCodeAt(0)),
      );
      pending = new Uint8Array(decoded.pending);
      if (!decoded.samples.length) return;
      heard += decoded.samples.length;
      onChunk(decoded.samples);
    },
  });

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      parser.feed(next.value);
    }
    parser.reset({ consume: true });
  } finally {
    reader.releaseLock();
  }

  if (!completed || !heard || pending.length) throw new Error("Incomplete speech stream");
}

/**
 * Speaks one piece of text on the shared device and resolves when it has been
 * heard. Used by the recorder and the teaching voice; a call uses the queue.
 */
export async function streamSpeech(text: string, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  const context = await unlockSharedAudio();
  if (!context) throw new Error("No audio device");

  const sources = new Set<AudioBufferSourceNode>();
  let playhead = 0;
  let last: Promise<void> = Promise.resolve();
  const controller = new AbortController();
  const abort = () => {
    controller.abort();
    for (const source of sources) {
      try {
        source.stop();
      } catch {
        /* already finished */
      }
    }
  };
  signal?.addEventListener("abort", abort, { once: true });

  try {
    await fetchSpeechChunks(
      text,
      (samples) => {
        const buffer = context.createBuffer(1, samples.length, SPEECH_SAMPLE_RATE);
        buffer.copyToChannel(samples, 0);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        sources.add(source);
        last = new Promise<void>((resolve) => {
          source.onended = () => {
            sources.delete(source);
            resolve();
          };
        });
        // Device startup can clip audio scheduled exactly at currentTime.
        playhead = Math.max(playhead, context.currentTime + 0.05);
        source.start(playhead);
        playhead += buffer.duration;
      },
      controller.signal,
    );
    await last;
    signal?.throwIfAborted();
  } finally {
    signal?.removeEventListener("abort", abort);
    controller.abort();
  }
}

export { sharedAudioContext };

/** Last resort so a reply is never silent when streamed speech is unavailable. */
export function speakWithBrowserVoice(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 900));
    utterance.rate = 1.02;
    window.speechSynthesis.speak(utterance);
  } catch {
    /* speech is a courtesy, never a requirement */
  }
}

export function stopBrowserVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* nothing to stop */
  }
}
