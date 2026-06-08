// Shared SpeechRecognition wrapper used by both AiPopover and AiEditPanel.
// Returns a tiny controller so callers can render their own mic button while
// the actual mic logic stays here.
import { useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";

export function useVoiceInput(onTranscript: (next: string | ((prev: string) => string)) => void) {
  const [listening, setListening] = useState(false);
  const recogRef = useRef<any>(null);

  const start = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast({ title: "Voice not supported in this browser" }); return; }
    try {
      const r = new SR();
      r.continuous = false; r.interimResults = true; r.lang = "en-US";
      r.onresult = (e: any) => {
        let finalT = "", interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalT += t; else interim += t;
        }
        onTranscript((p) => (finalT ? (p ? `${p} ${finalT}`.trim() : finalT) : interim || p));
      };
      r.onend = () => setListening(false);
      r.onerror = () => setListening(false);
      recogRef.current = r;
      r.start();
      setListening(true);
    } catch { setListening(false); }
  };

  const stop = () => {
    try { recogRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  };

  return { listening, start, stop };
}
