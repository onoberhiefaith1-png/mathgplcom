// Phase 4 — plays Aura's streamed voice in the browser, chunk by chunk, so she
// starts speaking as soon as the first audio arrives.

import { createParser } from "eventsource-parser";

const SPEECH_ENDPOINT = "/api/aura-speech";
const SAMPLE_RATE = 24000;

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

export async function streamSpeech(text: string, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  const context = new AudioContext({ sampleRate: SAMPLE_RATE });
  const sources = new Set<AudioBufferSourceNode>();
  let playhead = 0;
  let pending = new Uint8Array(0);
  let completed = false;
  let samplesPlayed = 0;
  const controller = new AbortController();
  const abort = () => {
    controller.abort();
    for (const source of sources) source.stop();
  };
  signal?.addEventListener("abort", abort, { once: true });
  let playback: Promise<void> = Promise.resolve();

  try {
    if (context.state === "suspended") await context.resume();
    const response = await fetch(SPEECH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      throw new Error(`Speech failed: ${response.status} ${await response.text()}`);
    }

    const parser = createParser({
      onEvent(event) {
        const payload = JSON.parse(event.data) as {
          type?: string;
          audio?: string;
          error?: unknown;
        };
        if (payload.type === "error" || payload.error) {
          throw new Error(`Speech failed: ${event.data}`);
        }
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
        samplesPlayed += decoded.samples.length;

        const buffer = context.createBuffer(1, decoded.samples.length, SAMPLE_RATE);
        buffer.copyToChannel(decoded.samples, 0);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        sources.add(source);
        playback = new Promise<void>((resolve) => {
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

    if (!completed || !samplesPlayed || pending.length) throw new Error("Incomplete speech stream");
    await playback;
    signal?.throwIfAborted();
  } finally {
    signal?.removeEventListener("abort", abort);
    controller.abort();
    for (const source of sources) source.stop();
    await context.close();
  }
}

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
