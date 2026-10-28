// Hearing that actually works on a phone.
//
// The browser's own speech listener refuses to share a microphone the page is
// already holding: it starts, reports nothing wrong, and hands back silence —
// which is why the wave moved while no words ever appeared. So Aura records the
// one microphone she already holds and gets the words back from the platform's
// own transcription, exactly the way the editor does.
//
// Crucially the recording is cut **where the teacher pauses**, not on a
// stopwatch. A blind 1.5s cut handed the transcriber fragments that began and
// ended mid-word, so "text-to-speech" came back as "gas suspension".

import { looksMisheard } from "@/lib/agent/speechIntent";

/** Loudness (0..1, from the voice meter) at or above which someone is speaking. */
export const SPEAKING_LEVEL = 0.05;
/** How long it must stay quiet before the sentence is considered finished. */
export const SILENCE_HOLD_MS = 700;
/** A segment is never cut before this, so a short pause mid-phrase is kept whole. */
export const MIN_SEGMENT_MS = 1200;
/** Long unbroken speech is cut here so words still arrive while you talk. */
export const MAX_SEGMENT_MS = 12000;
/** Used only when no loudness reading is available. */
export const BLIND_SEGMENT_MS = 4000;
/** How often the loudness is sampled. */
export const WATCH_MS = 100;

/** The words Aura works with, so the transcriber stops guessing at car parts. */
export const VOCABULARY =
  "MathGPL, Aura, Smartboard, Floating Numbers, lesson note, session, question, " +
  "solution, micro-step, quadratic, factorise, equation, expression, algebra, " +
  "assignment, classwork, Adventure, Vault, class, student, marks.";

export type SegmentState = {
  /** How long this segment has been recording. */
  elapsedMs: number;
  /** How long it has been quiet at the end of this segment. */
  quietMs: number;
  /** Whether any speech at all has been heard in this segment. */
  heardSpeech: boolean;
};

/**
 * Where to cut the recording. Pure, so the decision is testable without a
 * microphone.
 */
export function shouldCloseSegment(state: SegmentState): boolean {
  if (state.elapsedMs >= MAX_SEGMENT_MS) return true;
  if (!state.heardSpeech) return false;
  if (state.elapsedMs < MIN_SEGMENT_MS) return false;
  return state.quietMs >= SILENCE_HOLD_MS;
}

/** The transcription endpoint, or null when the backend is not configured. */
export function transcribeEndpoint(): string | null {
  const base = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/functions/v1/speech-transcribe`;
}

export function transcribeSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    transcribeEndpoint() !== null
  );
}

function segmentMime(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return "";
}

/** Pull the spoken words out of the streamed transcription events. */
export function readTranscriptEvents(body: string): string {
  let text = "";
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const event = JSON.parse(payload) as { delta?: string; text?: string; type?: string };
      // Deltas arrive word by word; a completed event carries the whole slice.
      if (typeof event.delta === "string") text += event.delta;
      else if (typeof event.text === "string" && !text) text = event.text;
    } catch {
      /* a partial line is finished by the next chunk */
    }
  }
  return text.trim();
}

/** The hint sent with a recording: Aura's vocabulary plus what was said so far. */
export function segmentPrompt(said: string): string {
  const tail = said.trim().split(/\s+/).slice(-40).join(" ");
  return tail ? `${VOCABULARY} Continuing: ${tail}` : VOCABULARY;
}

export async function transcribeSegment(
  blob: Blob,
  options: { signal?: AbortSignal; said?: string } = {},
): Promise<string> {
  const endpoint = transcribeEndpoint();
  if (!endpoint) throw new Error("Transcription is not configured");
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
  const form = new FormData();
  const extension = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
  form.append("file", new File([blob], `slice.${extension}`, { type: blob.type || "audio/webm" }));
  // English is the conversation's language: telling the transcriber so stops it
  // guessing at another language when a word is unclear.
  form.append("language", "en");
  // The words already heard, so the next piece is read in context.
  form.append("prompt", segmentPrompt(options.said ?? ""));
  const response = await fetch(endpoint, {
    method: "POST",
    headers: key ? { apikey: key, Authorization: `Bearer ${key}` } : {},
    body: form,
    ...(options.signal ? { signal: options.signal } : {}),
  });
  const body = await response.text();
  if (!response.ok) {
    let detail = "";
    try {
      detail = (JSON.parse(body) as { error?: string }).error ?? "";
    } catch {
      detail = body.slice(0, 120);
    }
    throw new Error(detail || `Transcription failed (${response.status})`);
  }
  const heard = readTranscriptEvents(body);
  // A slice that comes back in another script is a mishearing, not speech.
  return looksMisheard(heard) ? "" : heard;
}

/** What one finished recording cost, for the diagnostics panel. */
export type SegmentReport = {
  /** How long the recording was. */
  recordedMs: number;
  /** How long transcription took to answer. */
  roundTripMs: number;
  /** Why the recording was closed. */
  reason: "pause" | "ceiling" | "stopped";
  /** The words it came back with, or null on failure. */
  heard: string | null;
  error?: string;
};

type ListenerOptions = {
  stream: MediaStream;
  /** Words from one finished recording, to be added to the end of the turn. */
  onHeard: (text: string) => void;
  /** A recording is out for transcription, so the turn must not close yet. */
  onPending: (pending: boolean) => void;
  onError: (cause: unknown) => void;
  /** Current loudness, 0..1. Without it, recordings are cut on a timer. */
  getLevel?: () => number;
  /** Everything heard in this turn so far, sent along as context. */
  getSaid?: () => string;
  /** Timing for the diagnostics panel. */
  onReport?: (report: SegmentReport) => void;
};

/**
 * Records the held microphone and reports the words back. One recorder, one
 * device — nothing competes, so nothing ever goes silent and the browser is
 * never asked for permission again. Each recording is closed at a pause, so the
 * transcriber always receives whole words.
 */
export class TranscriptionListener {
  private recorder: MediaRecorder | null = null;
  private running = false;
  private outstanding = 0;
  private controller: AbortController | null = null;
  private watch: number | null = null;

  constructor(private readonly options: ListenerOptions) {}

  get active() {
    return this.running;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.controller = new AbortController();
    this.cycle();
  }

  stop() {
    this.running = false;
    this.clearWatch();
    this.controller?.abort();
    this.controller = null;
    try {
      if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    } catch {
      /* already stopped */
    }
    this.recorder = null;
    this.outstanding = 0;
    this.options.onPending(false);
  }

  private clearWatch() {
    if (this.watch !== null) window.clearInterval(this.watch);
    this.watch = null;
  }

  /** Record until the teacher pauses, send it, then immediately record again. */
  private cycle() {
    if (!this.running) return;
    const live = this.options.stream.getAudioTracks().some((t) => t.readyState === "live");
    if (!live) {
      this.options.onError(new Error("The microphone stopped"));
      this.running = false;
      return;
    }
    let recorder: MediaRecorder;
    try {
      const mimeType = segmentMime();
      recorder = new MediaRecorder(this.options.stream, mimeType ? { mimeType } : undefined);
    } catch (cause) {
      this.options.onError(cause);
      this.running = false;
      return;
    }
    this.recorder = recorder;
    const pieces: Blob[] = [];
    const startedAt = Date.now();
    const state: SegmentState = { elapsedMs: 0, quietMs: 0, heardSpeech: false };
    let reason: SegmentReport["reason"] = "stopped";

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) pieces.push(event.data);
    };
    recorder.onstop = () => {
      this.clearWatch();
      const recordedMs = Date.now() - startedAt;
      // Start the next recording first, so speech is never missed in between.
      if (this.running) this.cycle();
      if (pieces.length === 0) return;
      const blob = new Blob(pieces, { type: recorder.mimeType || "audio/webm" });
      void this.send(blob, recordedMs, reason);
    };
    recorder.start();

    const close = (why: SegmentReport["reason"]) => {
      reason = why;
      this.clearWatch();
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        /* already stopped */
      }
    };

    const level = this.options.getLevel;
    this.watch = window.setInterval(() => {
      state.elapsedMs = Date.now() - startedAt;
      if (!level) {
        if (state.elapsedMs >= BLIND_SEGMENT_MS) close("pause");
        return;
      }
      const loud = level() >= SPEAKING_LEVEL;
      if (loud) {
        state.heardSpeech = true;
        state.quietMs = 0;
      } else {
        state.quietMs += WATCH_MS;
      }
      if (shouldCloseSegment(state)) {
        close(state.elapsedMs >= MAX_SEGMENT_MS ? "ceiling" : "pause");
      }
    }, WATCH_MS);
  }

  private async send(blob: Blob, recordedMs: number, reason: SegmentReport["reason"]) {
    // Too small to hold speech: skip it rather than pay for silence.
    if (blob.size < 2000) return;
    this.outstanding += 1;
    this.options.onPending(true);
    const sentAt = Date.now();
    try {
      const text = await transcribeSegment(blob, {
        ...(this.controller?.signal ? { signal: this.controller.signal } : {}),
        said: this.options.getSaid?.() ?? "",
      });
      this.options.onReport?.({
        recordedMs,
        roundTripMs: Date.now() - sentAt,
        reason,
        heard: text,
      });
      if (text) this.options.onHeard(text);
    } catch (cause) {
      if ((cause as { name?: string })?.name !== "AbortError") {
        this.options.onReport?.({
          recordedMs,
          roundTripMs: Date.now() - sentAt,
          reason,
          heard: null,
          error: cause instanceof Error ? cause.message : String(cause),
        });
        this.options.onError(cause);
      }
    } finally {
      this.outstanding = Math.max(0, this.outstanding - 1);
      if (this.outstanding === 0) this.options.onPending(false);
    }
  }
}
