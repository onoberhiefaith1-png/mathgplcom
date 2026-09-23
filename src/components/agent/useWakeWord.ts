// Phase 4 — the "Aura" wake word. The microphone listens quietly in the
// background; when the teacher says "Aura ..." the rest of the sentence becomes
// her instruction. Saying just "Aura" opens the cockpit and waits.

import { useCallback, useEffect, useRef, useState } from "react";

type RecognitionResultLike = { 0: { transcript: string }; isFinal: boolean };
type RecognitionEventLike = { resultIndex: number; results: ArrayLike<RecognitionResultLike> };
type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
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
const WAKE_WORDS = ["aura", "ora", "aurra", "arrow ah", "aurah", "hora"];

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

type WakeHandlers = {
  /** Called with the words that followed the name; empty string means name only. */
  onWake: (command: string) => void;
  /** True while Aura is speaking or working, so her own voice cannot wake her. */
  paused?: boolean;
};

export function useWakeWord({ onWake, paused }: WakeHandlers) {
  const [supported, setSupported] = useState(false);
  const [armed, setArmed] = useState(false);
  const [heard, setHeard] = useState("");
  const recognition = useRef<RecognitionLike | null>(null);
  const wanted = useRef(false);
  const pausedRef = useRef(Boolean(paused));
  const handler = useRef(onWake);

  useEffect(() => {
    handler.current = onWake;
  }, [onWake]);

  useEffect(() => {
    pausedRef.current = Boolean(paused);
  }, [paused]);

  useEffect(() => {
    setSupported(recognitionConstructor() !== null);
    return () => {
      wanted.current = false;
      try {
        recognition.current?.stop();
      } catch {
        /* nothing to stop */
      }
    };
  }, []);

  const begin = useCallback(() => {
    const Ctor = recognitionConstructor();
    if (!Ctor || !wanted.current) return;
    try {
      const instance = new Ctor();
      instance.lang = document.documentElement.lang || "en-US";
      instance.continuous = true;
      instance.interimResults = true;
      instance.onresult = (event) => {
        let text = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result) text += result[0].transcript;
        }
        const trimmed = text.trim();
        if (!trimmed) return;
        setHeard(trimmed.slice(-80));
        if (pausedRef.current) return;
        const { woke, command } = extractWakeCommand(trimmed);
        if (woke) {
          setHeard("");
          handler.current(command);
        }
      };
      // Browsers end long recognition sessions on their own; restart quietly.
      instance.onend = () => {
        if (wanted.current) window.setTimeout(begin, 400);
        else setArmed(false);
      };
      instance.onerror = () => {
        if (!wanted.current) setArmed(false);
      };
      recognition.current = instance;
      instance.start();
      setArmed(true);
    } catch {
      setArmed(false);
    }
  }, []);

  const start = useCallback(() => {
    wanted.current = true;
    begin();
  }, [begin]);

  const stop = useCallback(() => {
    wanted.current = false;
    setHeard("");
    try {
      recognition.current?.stop();
    } catch {
      /* already stopped */
    }
    setArmed(false);
  }, []);

  return { supported, armed, heard, start, stop };
}
