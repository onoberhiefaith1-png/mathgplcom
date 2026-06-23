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
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";

type Updater = (next: string | ((prev: string) => string)) => void;

// Browser SpeechRecognition is a singleton-like resource in practice. If one
// page leaves a recognizer alive while another page starts one, Chrome can get
// stuck in a state where the mic button pulses but no transcript arrives. Keep
// one active session globally and always release it on unmount/error.
let activeSessionStop: (() => void) | null = null;

export function useVoiceInput(onTranscript: Updater) {
  const [listening, setListening] = useState(false);

  const recogRef = useRef<any>(null);
  const committedRef = useRef<string>("");      // already-finalized text for this dictation session
  const interimRef = useRef<string>("");        // current interim guess (volatile)
  const stoppedByUserRef = useRef<boolean>(true);
  const restartTimerRef = useRef<number | null>(null);
  const onTranscriptRef = useRef<Updater>(onTranscript);
  const mountedRef = useRef<boolean>(true);
  onTranscriptRef.current = onTranscript;

  const clearRestartTimer = () => {
    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  };

  const releaseRecognizer = (r?: any) => {
    if (!r || recogRef.current === r) recogRef.current = null;
    if (activeSessionStop === stopRef.current) activeSessionStop = null;
  };

  const stopRef = useRef<() => void>(() => {});

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
        releaseRecognizer(r);
        if (mountedRef.current) setListening(false);
        return;
      }
      // Short pause — auto-restart so the teacher can keep talking.
      interimRef.current = "";
      clearRestartTimer();
      restartTimerRef.current = window.setTimeout(() => {
        if (!mountedRef.current || stoppedByUserRef.current || recogRef.current !== r) return;
        try {
          r.start();
          if (mountedRef.current) setListening(true);
        } catch (err: any) {
          // A restart that is blocked by browser gesture policy must not leave
          // a stale recognizer in place, otherwise the next tap appears broken.
          stoppedByUserRef.current = true;
          releaseRecognizer(r);
          if (mountedRef.current) setListening(false);
          if (err?.name === "NotAllowedError") {
            toast({ title: "Tap the mic again to continue voice input" });
          }
        }
      }, 120);
    };

    r.onerror = (ev: any) => {
      // `no-speech` / `aborted` happen during normal pauses — keep going.
      if (ev?.error === "no-speech" || ev?.error === "aborted") return;
      stoppedByUserRef.current = true;
      clearRestartTimer();
      releaseRecognizer(r);
      if (mountedRef.current) setListening(false);
      const message =
        ev?.error === "not-allowed"
          ? "Microphone permission is blocked. Allow microphone access, then tap again."
          : ev?.error === "audio-capture"
            ? "No microphone was detected. Check your mic, then tap again."
            : "Voice input stopped. Tap the mic again to continue.";
      toast({ title: message });
    };

    return r;
  };

  const start = useCallback(() => {
    if (recogRef.current) return; // already listening in this component
    activeSessionStop?.();
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
    activeSessionStop = stopRef.current;
    try {
      r.start();
      setListening(true);
    } catch {
      releaseRecognizer(r);
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    stoppedByUserRef.current = true;
    clearRestartTimer();
    const r = recogRef.current;
    try { r?.stop(); } catch { /* noop */ }
    releaseRecognizer(r);
    setListening(false);
  }, []);

  stopRef.current = stop;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopRef.current();
    };
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
