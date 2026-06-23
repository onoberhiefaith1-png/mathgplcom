// Continuous dictation wrapper around SpeechRecognition.
//
// Public surface is unchanged: { listening, start, stop }, plus an
// onTranscript callback that accepts a string updater. Behaviour:
//   • One spoken sentence → one transcription (no duplication).
//     Interim text is rendered live but is never written into the
//     committed buffer until the engine emits its final result.
//   • Pauses do not lose previous text — interim is rendered on top of
//     the committed buffer, never replacing it.
//   • Short pauses do not end the session. When SpeechRecognition fires
//     `onend` (which it does on every silence gap, regardless of the
//     `continuous` flag in some browsers), we transparently restart it
//     unless the user pressed the mic button to stop.
//   • When the user stops, any pending interim is flushed into the
//     committed buffer so nothing is lost.
import { useCallback, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";

type Updater = (next: string | ((prev: string) => string)) => void;

export function useVoiceInput(onTranscript: Updater) {
  const [listening, setListening] = useState(false);

  const recogRef = useRef<any>(null);
  const committedRef = useRef<string>("");      // already-finalized text for this dictation session
  const interimRef = useRef<string>("");        // current interim guess (volatile)
  const stoppedByUserRef = useRef<boolean>(true);
  const restartTimerRef = useRef<number | null>(null);
  const onTranscriptRef = useRef<Updater>(onTranscript);
  onTranscriptRef.current = onTranscript;

  const pushDisplay = () => {
    const c = committedRef.current;
    const i = interimRef.current;
    const joined = c && i ? `${c} ${i}` : c || i || "";
    onTranscriptRef.current(joined);
  };

  const buildRecognizer = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";

    r.onresult = (e: any) => {
      let newFinal = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) newFinal += t;
        else interim += t;
      }
      if (newFinal) {
        const trimmed = newFinal.trim();
        if (trimmed) {
          committedRef.current = committedRef.current
            ? `${committedRef.current} ${trimmed}`
            : trimmed;
        }
      }
      interimRef.current = interim.trim();
      pushDisplay();
    };

    r.onend = () => {
      // Flush any lingering interim into committed so a hard stop doesn't drop it.
      if (stoppedByUserRef.current) {
        if (interimRef.current) {
          committedRef.current = committedRef.current
            ? `${committedRef.current} ${interimRef.current}`
            : interimRef.current;
          interimRef.current = "";
          pushDisplay();
        }
        setListening(false);
        return;
      }
      // Short pause — auto-restart so the teacher can keep talking.
      interimRef.current = "";
      if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = window.setTimeout(() => {
        try { recogRef.current?.start(); } catch { /* already started */ }
      }, 120);
    };

    r.onerror = (ev: any) => {
      // `no-speech` / `aborted` happen during normal pauses — keep going.
      if (ev?.error === "no-speech" || ev?.error === "aborted") return;
      stoppedByUserRef.current = true;
      setListening(false);
    };

    return r;
  };

  const start = useCallback(() => {
    if (recogRef.current) return; // already listening
    const r = buildRecognizer();
    if (!r) { toast({ title: "Voice not supported in this browser" }); return; }

    // Seed committed from the textbox's current value so dictation appends
    // to whatever the user already typed, instead of replacing it.
    let seed = "";
    onTranscriptRef.current((prev) => { seed = prev ?? ""; return prev ?? ""; });
    committedRef.current = seed;
    interimRef.current = "";
    stoppedByUserRef.current = false;
    recogRef.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      recogRef.current = null;
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    stoppedByUserRef.current = true;
    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    try { recogRef.current?.stop(); } catch { /* noop */ }
    recogRef.current = null;
    setListening(false);
  }, []);

  // Clear internal buffers without stopping recognition. Call after the
  // textbox is sent/cleared so the next spoken phrase starts fresh rather
  // than re-appending the previous message.
  const reset = useCallback(() => {
    committedRef.current = "";
    interimRef.current = "";
  }, []);

  return { listening, start, stop, reset };
}
