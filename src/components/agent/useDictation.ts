// Phase 3 — voice notes into the cockpit: the teacher speaks, the words land in
// the composer so they can still be edited before Aura acts on them.

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

export function useDictation(onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<RecognitionLike | null>(null);
  const handler = useRef(onText);

  useEffect(() => {
    handler.current = onText;
  }, [onText]);

  useEffect(() => {
    setSupported(recognitionConstructor() !== null);
    return () => {
      try {
        recognition.current?.stop();
      } catch {
        /* nothing to stop */
      }
    };
  }, []);

  const stop = useCallback(() => {
    try {
      recognition.current?.stop();
    } catch {
      /* already stopped */
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionConstructor();
    if (!Ctor) return;
    try {
      const instance = new Ctor();
      instance.lang = document.documentElement.lang || "en-US";
      instance.continuous = true;
      instance.interimResults = false;
      instance.onresult = (event) => {
        let text = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result?.isFinal) text += result[0].transcript;
        }
        const trimmed = text.trim();
        if (trimmed) handler.current(trimmed);
      };
      instance.onend = () => setListening(false);
      instance.onerror = () => setListening(false);
      recognition.current = instance;
      instance.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { supported, listening, start, stop, toggle };
}
