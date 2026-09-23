// One microphone for Aura. The wake word and the recorder button both read from
// this single engine, because a browser only ever allows one listener at a time
// — two competing listeners is exactly why nothing was being heard.

import { useCallback, useEffect, useRef, useState } from "react";

import { classifyMicError, heldMicrophone, requestMicrophoneAccess } from "./micPermission";

export type ListeningMode = "off" | "wake" | "capture";

export type ListeningError =
  | "unsupported"
  | "blocked"
  | "in-use"
  | "no-microphone"
  | "unavailable"
  | "failed";


type RecognitionResultLike = { 0: { transcript: string }; isFinal: boolean };
type RecognitionEventLike = { resultIndex: number; results: ArrayLike<RecognitionResultLike> };
type RecognitionErrorLike = { error?: string };
type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: RecognitionErrorLike) => void) | null;
};

function recognitionConstructor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike;
    webkitSpeechRecognition?: new () => RecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Common mishearings of the name, so she still answers in a noisy classroom. */
const WAKE_WORDS = ["aura", "ora", "aurra", "aurah", "hora", "arrow ah"];

export function extractWakeCommand(heard: string): { woke: boolean; command: string } {
  const text = heard.toLowerCase().replace(/[.,!?]/g, " ").replace(/\s+/g, " ").trim();
  for (const word of WAKE_WORDS) {
    const at = text.indexOf(word);
    if (at === -1) continue;
    const before = at === 0 ? "" : text[at - 1];
    const after = text[at + word.length] ?? "";
    const standalone = (before === "" || before === " ") && (after === "" || after === " ");
    if (!standalone) continue;
    return { woke: true, command: heard.slice(at + word.length).replace(/^[\s,.:;]+/, "").trim() };
  }
  return { woke: false, command: "" };
}

export function describeListeningError(error: ListeningError): string {
  if (error === "unsupported") return "This browser can't listen. Type to me instead.";
  if (error === "blocked") return "I need permission to use your microphone.";
  if (error === "in-use") return "Another app is holding your microphone. Close it, then try again.";
  if (error === "no-microphone") return "No microphone detected on this device.";
  if (error === "unavailable") return "Listening isn't available right now.";
  return "I lost the microphone. Tap to try again.";
}

export function mapRecognitionError(code: string | undefined): ListeningError | null {
  if (code === "not-allowed" || code === "permission-denied") return "blocked";
  // Recognition losing the audio proves nothing about the device existing, so
  // this is never reported as a missing microphone.
  if (code === "audio-capture") return "failed";
  if (code === "service-not-allowed" || code === "language-not-supported") return "unavailable";
  // A silence timeout or a deliberate stop is normal, not a failure.
  if (code === "no-speech" || code === "aborted") return null;
  return "failed";
}


type ListeningOptions = {
  /** Called with the words spoken after her name. Empty string means name only. */
  onWake: (command: string) => void;
  /** True while Aura speaks or works, so her own voice can never wake her. */
  paused: boolean;
};

const MAX_CONSECUTIVE_FAILURES = 4;

export function useListening({ onWake, paused }: ListeningOptions) {
  const [supported, setSupported] = useState(false);
  const [mode, setMode] = useState<ListeningMode>("off");
  const [level, setLevel] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<ListeningError | null>(null);

  const recognition = useRef<RecognitionLike | null>(null);
  const wanted = useRef<ListeningMode>("off");
  const failures = useRef(0);
  const restart = useRef<number | null>(null);
  const finalText = useRef("");
  /** True while a live guess is on screen but its finished words have not landed. */
  const awaitingFinal = useRef(false);

  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const meter = useRef<number | null>(null);
  /** The microphone she was granted, kept so it is never asked for twice. */
  const held = useRef<MediaStream | null>(null);
  const liveHeld = useCallback(() => {
    const mine = held.current;
    if (mine && mine.getAudioTracks().some((track) => track.readyState === "live")) return mine;
    held.current = null;
    // The page-wide microphone, granted once and kept for the whole visit.
    return heldMicrophone();
  }, []);


  const wake = useRef(onWake);
  const pausedRef = useRef(paused);
  useEffect(() => {
    wake.current = onWake;
  }, [onWake]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    setSupported(recognitionConstructor() !== null);
  }, []);

  const stopMeter = useCallback(() => {
    if (meter.current !== null) cancelAnimationFrame(meter.current);
    meter.current = null;
    analyser.current = null;
    // The microphone itself is deliberately left running. Stopping its tracks is
    // what made the browser ask for permission again every few seconds.
    stream.current = null;
    void audio.current?.close().catch(() => undefined);
    audio.current = null;
    setLevel(0);
  }, []);

  // The wave is driven by the real voice level, so it moves with the teacher.
  // A stream that was already granted is reused, never requested a second time.
  const startMeter = useCallback(async (provided?: MediaStream | null) => {
    if (analyser.current || typeof navigator === "undefined" || !navigator.mediaDevices) return;
    let media = provided ?? null;
    if (!media) {
      const result = await requestMicrophoneAccess();
      if (!result.stream) {
        const state = result.state;
        setError(
          state === "blocked" || state === "in-use" || state === "no-microphone"
            ? state
            : state === "unsupported" || state === "insecure" || state === "framed"
              ? "unavailable"
              : "failed",
        );
        return;
      }
      media = result.stream;
    }
    try {
      stream.current = media;
      const context = new AudioContext();
      audio.current = context;
      if (context.state === "suspended") await context.resume();
      const node = context.createAnalyser();
      node.fftSize = 512;
      context.createMediaStreamSource(media).connect(node);
      analyser.current = node;

      const samples = new Float32Array(node.fftSize);
      const tick = () => {
        const active = analyser.current;
        if (!active) return;
        active.getFloatTimeDomainData(samples);
        let sum = 0;
        for (let index = 0; index < samples.length; index += 1) {
          const sample = samples[index] ?? 0;
          sum += sample * sample;
        }
        const rms = Math.sqrt(sum / samples.length);
        setLevel((previous) => {
          const next = Math.min(1, rms * 6);
          // Rise quickly, fall smoothly, the way a voice meter reads.
          return next > previous ? next : previous * 0.82 + next * 0.18;
        });
        meter.current = requestAnimationFrame(tick);
      };
      meter.current = requestAnimationFrame(tick);
    } catch (cause) {
      setError((await classifyMicError(cause)) === "blocked" ? "blocked" : "failed");
    }
  }, []);


  const begin = useCallback(() => {
    const Ctor = recognitionConstructor();
    if (!Ctor) {
      setError("unsupported");
      return;
    }
    if (wanted.current === "off") return;
    try {
      const instance = new Ctor();
      instance.lang = document.documentElement.lang || "en-US";
      instance.continuous = true;
      instance.interimResults = true;

      instance.onresult = (event) => {
        let interim = "";
        let finalHeard = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (!result) continue;
          if (result.isFinal) finalHeard = `${finalHeard} ${result[0].transcript}`.trim();
          else interim += result[0].transcript;
        }
        failures.current = 0;
        // A live guess means the engine still owes us the finished words; a turn
        // must never close on the silence timer while that is outstanding.
        awaitingFinal.current = interim.trim().length > 0;
        // Her own voice must never become an instruction, not even a stray word
        // of it: while she speaks or works, nothing heard is kept.
        if (pausedRef.current) {
          finalText.current = "";
          setTranscript("");
          return;
        }
        // Everything heard in this turn is added together, never replaced, so
        // "let's go" is still there when "come home" arrives.
        if (finalHeard) finalText.current = `${finalText.current} ${finalHeard}`.trim();
        const heard = `${finalText.current} ${interim}`.trim();
        if (!heard) return;




        if (wanted.current === "wake") {
          const { woke, command } = extractWakeCommand(heard);
          if (!woke) {
            setTranscript(heard.slice(-90));
            return;
          }
          finalText.current = command;
          setTranscript(command);
          wanted.current = "capture";
          setMode("capture");
          void startMeter(liveHeld());
          wake.current(command);
          return;
        }
        setTranscript(heard);
      };

      instance.onerror = (event) => {
        const mapped = mapRecognitionError(event?.error);
        if (!mapped) return;
        setError(mapped);
        if (mapped === "blocked" || mapped === "no-microphone" || mapped === "unavailable") {
          wanted.current = "off";
          setMode("off");
          stopMeter();
        }
      };

      // Browsers end long sessions on their own; pick it straight back up. A
      // session that ran normally is not a failure — counting those is what made
      // listening give up and look like lost permission.
      const startedAt = Date.now();
      instance.onend = () => {
        if (wanted.current === "off") {
          setMode("off");
          return;
        }
        const ranProperly = Date.now() - startedAt > 1000;
        failures.current = ranProperly ? 0 : failures.current + 1;
        if (failures.current > MAX_CONSECUTIVE_FAILURES) {
          wanted.current = "off";
          setMode("off");
          stopMeter();
          setError((previous) => previous ?? "failed");
          return;
        }
        restart.current = window.setTimeout(begin, ranProperly ? 200 : 350 * failures.current);
      };

      recognition.current = instance;
      instance.start();
      setMode(wanted.current);
    } catch {
      setError("failed");
      setMode("off");
    }
  }, [liveHeld, startMeter, stopMeter]);

  const start = useCallback(
    (next: Exclude<ListeningMode, "off">, granted?: MediaStream | null) => {
      setError(null);
      finalText.current = "";
      setTranscript("");
      failures.current = 0;
      if (granted && granted.getAudioTracks().some((track) => track.readyState === "live")) {
        held.current = granted;
      }
      const switching = wanted.current !== "off" && wanted.current !== next;
      wanted.current = next;
      if (next === "capture") void startMeter(liveHeld());
      else stopMeter();

      if (restart.current !== null) window.clearTimeout(restart.current);
      restart.current = null;

      if (switching || recognition.current) {
        // One instance only — restart the existing session in the new mode.
        try {
          recognition.current?.abort?.();
          recognition.current?.stop();
        } catch {
          /* already stopped */
        }
        recognition.current = null;
        restart.current = window.setTimeout(begin, 120);
        setMode(next);
        return;
      }
      begin();
    },
    [begin, liveHeld, startMeter, stopMeter],
  );


  const stop = useCallback(() => {
    wanted.current = "off";
    if (restart.current !== null) window.clearTimeout(restart.current);
    restart.current = null;
    try {
      recognition.current?.abort?.();
      recognition.current?.stop();
    } catch {
      /* already stopped */
    }
    recognition.current = null;
    finalText.current = "";
    setTranscript("");
    setMode("off");
    stopMeter();
  }, [stopMeter]);

  const clearTranscript = useCallback(() => {
    finalText.current = "";
    awaitingFinal.current = false;
    setTranscript("");
  }, []);

  /**
   * The teacher corrected what was heard: their wording replaces the words the
   * engine accumulated, so anything they say next is added to their version.
   */
  const editTranscript = useCallback((text: string) => {
    finalText.current = text;
    awaitingFinal.current = false;
    setTranscript(text);
  }, []);

  /** Whether the listening engine still owes us the end of the sentence. */
  const finalPending = useCallback(() => awaitingFinal.current, []);

  const clearError = useCallback(() => setError(null), []);

  // Locking the phone or switching apps ends the engine; coming back resumes it
  // without touching the microphone and without ever asking again.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const resume = () => {
      if (document.visibilityState !== "visible") return;
      if (wanted.current === "off" || recognition.current) return;
      failures.current = 0;
      if (restart.current !== null) window.clearTimeout(restart.current);
      restart.current = window.setTimeout(begin, 200);
    };
    document.addEventListener("visibilitychange", resume);
    return () => document.removeEventListener("visibilitychange", resume);
  }, [begin]);

  useEffect(
    () => () => {
      wanted.current = "off";
      if (restart.current !== null) window.clearTimeout(restart.current);
      try {
        recognition.current?.abort?.();
        recognition.current?.stop();
      } catch {
        /* nothing to stop */
      }
      stopMeter();
    },
    [stopMeter],
  );

  return {
    supported,
    mode,
    level,
    transcript,
    error,
    errorMessage: error ? describeListeningError(error) : null,
    start,
    stop,
    clearTranscript,
    finalPending,
    clearError,
  };
}

export type ListeningEngine = ReturnType<typeof useListening>;
