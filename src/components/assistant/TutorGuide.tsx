// MathGPL Tutor Guide: demonstrates a stored solution line by line, building
// each line one Floating Number at a time while the device's own voice explains
// it. Works offline and costs nothing; it never invents mathematics.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraduationCap, Mic, Pause, Play, RotateCcw, SkipForward, LifeBuoy, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { registerTutorAction } from "@/lib/assistant/actions";
import { answerGuide, buildGuideScript, coachLine, guideQuestion, type GuideLine } from "@/lib/assistant/guide";

function speakNow(text: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

export default function TutorGuide({ lines, currentLine = 0, autoStart = false, onClose }: {
  lines: GuideLine[]; currentLine?: number; autoStart?: boolean; onClose?: () => void;
}) {
  const script = useMemo(() => buildGuideScript(lines), [lines]);
  const [step, setStep] = useState(-1);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [caption, setCaption] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playingRef = useRef(false);

  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const say = useCallback((text: string, onEnd?: () => void) => { setCaption(text); speakNow(text, onEnd); }, []);

  /** Show one step: chips appear one by one while the explanation is spoken. */
  const playStep = useCallback((i: number, chain: boolean) => {
    clear();
    const s = script[i];
    if (!s) { setPlaying(false); playingRef.current = false; return; }
    setStep(i);
    setShown(0);
    let n = 0;
    const tick = () => { n += 1; setShown(n); if (n < s.chips.length) timer.current = setTimeout(tick, 450); };
    timer.current = setTimeout(tick, 200);
    say(s.speech, () => {
      if (chain && playingRef.current && i + 1 < script.length) timer.current = setTimeout(() => playStep(i + 1, true), 700);
      else if (i + 1 >= script.length) { setPlaying(false); playingRef.current = false; }
    });
  }, [say, script]);

  const start = useCallback(() => { playingRef.current = true; setPlaying(true); playStep(step < 0 || step >= script.length - 1 ? 0 : step + 1, true); }, [playStep, script.length, step]);
  const pause = useCallback(() => { playingRef.current = false; setPlaying(false); clear(); window.speechSynthesis?.cancel(); }, []);

  useEffect(() => () => { clear(); window.speechSynthesis?.cancel(); }, []);
  // Opened by Tutor: begin straight away (once).
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStarted.current || !script.length) return;
    autoStarted.current = true;
    const t = setTimeout(() => start(), 600); // let Tutor finish its own sentence
    return () => clearTimeout(t);
  }, [autoStart, script.length, start]);
  useEffect(() => {
    const a = registerTutorAction("guide.start", () => { start(); return { ok: true }; });
    const b = registerTutorAction("guide.stop", () => { pause(); return { ok: true, say: "Guide paused." }; });
    return () => { a(); b(); };
  }, [pause, start]);

  const ask = useCallback((text: string) => {
    const q = guideQuestion(text);
    const r = answerGuide(script, lines, Math.max(step, 0), q ?? "repeat");
    if (q === "next" || q === "previous" || q === "answer") playStep(r.step, false);
    else say(r.speech);
  }, [lines, playStep, say, script, step]);

  const listen = useCallback(() => {
    const W = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
    const SR = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!SR) { say("Listening isn't available here. Use the buttons instead."); return; }
    const rec = new SR();
    rec.lang = "en-GB";
    rec.onresult = (e: any) => ask(String(e.results?.[0]?.[0]?.transcript ?? ""));
    rec.start();
  }, [ask, say]);

  const helpMyLine = useCallback(() => {
    const target = script[Math.min(Math.max(currentLine, 0), script.length - 1)];
    if (!target) return;
    say(coachLine(target.equation, "", lines.filter((l) => l.equation?.trim())[target.index]?.note).speech);
  }, [currentLine, lines, say, script]);

  if (!script.length) return null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <GraduationCap className="size-4 text-primary" />
        <span className="flex-1 text-sm font-semibold">MathGPL Tutor</span>
        <span className="text-[11px] text-muted-foreground">Works offline</span>
        {onClose && (
          <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Close guide" onClick={() => { pause(); onClose(); }}>
            <X className="size-4" />
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {script.map((s, i) => (
          i > step ? null : (
            <div key={i} className={`rounded-md border px-3 py-2 text-lg font-medium ${i === step ? "border-primary bg-primary/5" : "border-border"}`}>
              {(i === step ? s.chips.slice(0, shown) : s.chips).map((c, j) => (
                <span key={j} className="mr-1 inline-block animate-in fade-in">{c}</span>
              ))}
            </div>
          )
        ))}
        {caption && <p className="text-sm text-muted-foreground">{caption}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border p-2">
        {playing
          ? <Button size="sm" variant="outline" onClick={pause}><Pause className="mr-1 size-4" />Pause</Button>
          : <Button size="sm" onClick={start}><Play className="mr-1 size-4" />{step < 0 ? "Start" : "Continue"}</Button>}
        <Button size="sm" variant="outline" aria-label="Next step" onClick={() => playStep(Math.min(step + 1, script.length - 1), false)}><SkipForward className="size-4" /></Button>
        <Button size="sm" variant="outline" aria-label="Replay" onClick={() => playStep(Math.max(step, 0), false)}><RotateCcw className="size-4" /></Button>
        <Button size="sm" variant="outline" onClick={helpMyLine}><LifeBuoy className="mr-1 size-4" />Help my line</Button>
        <Button size="sm" variant="outline" aria-label="Ask the Tutor" onClick={listen}><Mic className="size-4" /></Button>
      </div>
    </div>
  );
}
