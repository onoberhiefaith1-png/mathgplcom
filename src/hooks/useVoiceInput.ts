// Voice recording — press to start, press to stop. Nothing else ends it.
//
// Why this is not SpeechRecognition any more: the browser engine stops on
// every silence gap, restarts unpredictably, and re-emits phrases (the
// "write this board. write this board." duplication). Here we capture raw
// PCM with the Web Audio API for as long as the button is on, encode ONE
// complete 16 kHz mono WAV, and transcribe it in a single pass.
//
// Rules honoured:
//   • Recording continues through any pause until the button is pressed again.
//   • The transcript is APPENDED to whatever is already in the box, so a
//     second recording continues from the first instead of wiping it.
//   • One buffered pass ⇒ no repeated phrases.
//   • `level` (0..1) drives the live waveform, `seconds` the timer.

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";

type Updater = (next: string | ((prev: string) => string)) => void;

const TARGET_RATE = 16000;

function downsample(chunks: Float32Array[], from: number, to: number): Float32Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(total);
  let o = 0;
  for (const c of chunks) { merged.set(c, o); o += c.length; }
  if (to >= from) return merged;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(merged.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(merged.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += merged[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

function encodeWav(samples: Float32Array, rate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const str = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  str(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/** POST the WAV to the transcription function and read the SSE stream. */
async function transcribe(blob: Blob): Promise<string> {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const form = new FormData();
  form.append("file", blob, "recording.wav");

  const res = await fetch(`${base}/functions/v1/speech-transcribe`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail?.slice(0, 200) || `Transcription failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  let deltas = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload);
        if (ev?.type === "transcript.text.delta" && typeof ev.delta === "string") deltas += ev.delta;
        else if (ev?.type === "transcript.text.done" && typeof ev.text === "string") full = ev.text;
        else if (typeof ev?.text === "string") full = ev.text;
      } catch { /* ignore keepalives */ }
    }
  }
  return (full || deltas).trim();
}

export function useVoiceInput(onTranscript: Updater) {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);

  const onTranscriptRef = useRef<Updater>(onTranscript);
  onTranscriptRef.current = onTranscript;

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const stopRef = useRef<() => void>(() => {});

  const teardown = useCallback(() => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    try { nodeRef.current?.disconnect(); } catch { /* noop */ }
    try { srcRef.current?.disconnect(); } catch { /* noop */ }
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    try { void ctxRef.current?.close(); } catch { /* noop */ }
    nodeRef.current = null;
    srcRef.current = null;
    streamRef.current = null;
    ctxRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (listening || transcribing) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast({ title: "Microphone access is needed to record." });
      return;
    }
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const node = ctx.createScriptProcessor(4096, 1, 1);
    chunksRef.current = [];
    node.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0);
      chunksRef.current.push(new Float32Array(data));
      let peak = 0;
      for (let i = 0; i < data.length; i += 16) peak = Math.max(peak, Math.abs(data[i]));
      setLevel(Math.min(1, peak * 2.2));
    };
    source.connect(node);
    node.connect(ctx.destination);

    streamRef.current = stream;
    ctxRef.current = ctx;
    srcRef.current = source;
    nodeRef.current = node;
    setSeconds(0);
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    setListening(true);
  }, [listening, transcribing]);

  const stop = useCallback(async () => {
    if (!ctxRef.current) { setListening(false); return; }
    const rate = ctxRef.current.sampleRate;
    const chunks = chunksRef.current;
    chunksRef.current = [];
    teardown();
    setListening(false);
    setLevel(0);

    const samples = downsample(chunks, rate, TARGET_RATE);
    const blob = encodeWav(samples, TARGET_RATE);
    if (blob.size < 4096) {
      toast({ title: "That recording was empty — please try again." });
      return;
    }
    setTranscribing(true);
    try {
      const text = await transcribe(blob);
      if (!text) { toast({ title: "Nothing was heard — please try again." }); return; }
      // APPEND: a new recording continues from what is already there.
      onTranscriptRef.current((prev) => {
        const base = (prev ?? "").trim();
        return base ? `${base} ${text}` : text;
      });
    } catch (e: any) {
      toast({ title: "Transcription failed", description: String(e?.message ?? e) });
    } finally {
      if (mountedRef.current) setTranscribing(false);
    }
  }, [teardown]);

  stopRef.current = () => { void stop(); };

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; teardown(); };
  }, [teardown]);

  /** Clear the timer/level display after the host box was sent or cleared. */
  const reset = useCallback(() => { setSeconds(0); setLevel(0); }, []);

  return { listening, transcribing, level, seconds, start, stop, reset };
}
