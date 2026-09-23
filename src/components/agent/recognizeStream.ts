// Hearing that actually works on a phone.
//
// The browser's own speech listener refuses to share a microphone the page is
// already holding: it starts, reports nothing wrong, and hands back silence —
// which is why the wave moved while no words ever appeared. So Aura records
// short slices from the one microphone she already holds and gets the words back
// from the platform's own transcription, exactly the way the editor does.

const SEGMENT_MS = 1500;

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

export async function transcribeSegment(blob: Blob, signal?: AbortSignal): Promise<string> {
  const endpoint = transcribeEndpoint();
  if (!endpoint) throw new Error("Transcription is not configured");
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
  const form = new FormData();
  const extension = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
  form.append("file", new File([blob], `slice.${extension}`, { type: blob.type || "audio/webm" }));
  const response = await fetch(endpoint, {
    method: "POST",
    headers: key ? { apikey: key, Authorization: `Bearer ${key}` } : {},
    body: form,
    ...(signal ? { signal } : {}),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Transcription failed (${response.status})`);
  return readTranscriptEvents(body);
}

type ListenerOptions = {
  stream: MediaStream;
  /** Words from one finished slice, to be added to the end of the turn. */
  onHeard: (text: string) => void;
  /** A slice is out for transcription, so the turn must not close yet. */
  onPending: (pending: boolean) => void;
  onError: (cause: unknown) => void;
};

/**
 * Records the held microphone in short slices and reports the words back. One
 * recorder, one device — nothing competes, so nothing ever goes silent and the
 * browser is never asked for permission again.
 */
export class TranscriptionListener {
  private recorder: MediaRecorder | null = null;
  private running = false;
  private outstanding = 0;
  private controller: AbortController | null = null;
  private timer: number | null = null;

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
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
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

  /** Record one complete slice, send it, then immediately record the next. */
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
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) pieces.push(event.data);
    };
    recorder.onstop = () => {
      // Start the next slice first, so speech is never missed between slices.
      if (this.running) this.cycle();
      if (pieces.length === 0) return;
      void this.send(new Blob(pieces, { type: recorder.mimeType || "audio/webm" }));
    };
    recorder.start();
    this.timer = window.setTimeout(() => {
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        /* already stopped */
      }
    }, SEGMENT_MS);
  }

  private async send(blob: Blob) {
    // Too small to hold speech: skip it rather than pay for silence.
    if (blob.size < 2000) return;
    this.outstanding += 1;
    this.options.onPending(true);
    try {
      const text = await transcribeSegment(blob, this.controller?.signal);
      if (text) this.options.onHeard(text);
    } catch (cause) {
      if ((cause as { name?: string })?.name !== "AbortError") this.options.onError(cause);
    } finally {
      this.outstanding = Math.max(0, this.outstanding - 1);
      if (this.outstanding === 0) this.options.onPending(false);
    }
  }
}
