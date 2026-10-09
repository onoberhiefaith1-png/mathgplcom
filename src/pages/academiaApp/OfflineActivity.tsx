/**
 * Offline Practice / Play for one Academia question. Line 0 is the question;
 * # starts Line 1; every input is checked on the device and a complete,
 * equivalent line is marked at once. No AI, no network.
 */
import { useEffect, useRef, useState } from "react";
import { Check, Coins, Hash, Redo2, RotateCcw, Timer, Undo2, X } from "lucide-react";
import type { LocalAttempt, PackActivity } from "@/lib/offline/academiaStore";
import { markLine } from "@/lib/offline/marking";
import { offlineMediaUrl } from "@/lib/offline/prepareOffline";

type LineResult = { written: string; correct: boolean; marks: number; seconds: number };

export default function OfflineActivity({ activity, sessionId, mode, onFinish, onBack }: {
  activity: PackActivity; sessionId: string; mode: "practice" | "play";
  onFinish: (a: LocalAttempt) => void; onBack: () => void;
}) {
  const [round, setRound] = useState(0);
  return <Run key={round} activity={activity} sessionId={sessionId} mode={mode} onFinish={onFinish} onBack={onBack} onRetry={() => setRound((r) => r + 1)} />;
}

function Run({ activity, sessionId, mode, onFinish, onBack, onRetry }: {
  activity: PackActivity; sessionId: string; mode: "practice" | "play";
  onFinish: (a: LocalAttempt) => void; onBack: () => void; onRetry: () => void;
}) {
  const steps = activity.lines.slice(1);
  const max = steps.reduce((n, l) => n + l.marks, 0);
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [pieces, setPieces] = useState<string[]>([]);
  const [redo, setRedo] = useState<string[]>([]);
  const [results, setResults] = useState<LineResult[]>([]);
  const [left, setLeft] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const lineStart = useRef(Date.now());
  const runStart = useRef(Date.now());
  const videoRef = useRef<HTMLVideoElement>(null);
  const [auto, setAuto] = useState(true);
  const finished = started && idx >= steps.length;
  const score = results.reduce((n, r) => n + (r.correct ? r.marks : 0), 0);
  const written = pieces.join(" ");

  // Per-line timer (Play only), using the teacher's time for each line.
  useEffect(() => {
    if (mode !== "play" || !started || finished) { setLeft(null); return; }
    setLeft(steps[idx]?.timerSeconds ?? 60);
    const t = setInterval(() => setLeft((s) => (s === null ? s : s - 1)), 1000);
    return () => clearInterval(t);
  }, [mode, started, finished, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Time ran out on this line: record it unmarked and move on.
  useEffect(() => {
    if (left === null || left > 0 || finished) return;
    commit(false);
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto video follows the current line.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !auto || !started || finished) return;
    const seg = activity.videoSegments?.find((g) => g.lineId === steps[idx]?.id);
    if (!seg) return;
    v.currentTime = seg.start;
    void v.play().catch(() => undefined);
    const stop = () => { if (v.currentTime >= seg.end) v.pause(); };
    v.addEventListener("timeupdate", stop);
    return () => v.removeEventListener("timeupdate", stop);
  }, [idx, started, auto, finished]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!finished || saved) return;
    setSaved(true);
    onFinish({
      id: crypto.randomUUID(), activityId: activity.id, sessionId, mode, score, maxScore: max,
      at: new Date().toISOString(), synced: false, lines: results,
      seconds: Math.round((Date.now() - runStart.current) / 1000),
    });
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  function commit(correct: boolean, text = written) {
    const step = steps[idx];
    setResults((r) => [...r, { written: text, correct, marks: step.marks, seconds: Math.round((Date.now() - lineStart.current) / 1000) }]);
    setPieces([]); setRedo([]);
    lineStart.current = Date.now();
    setIdx((i) => i + 1);
  }

  // Marked on the same input that completes the line.
  const place = (next: string[]) => {
    setPieces(next); setRedo([]);
    const text = next.join(" ");
    if (markLine(steps[idx].equation, text)) commit(true, text);
  };

  const start = () => { setStarted(true); runStart.current = Date.now(); lineStart.current = Date.now(); };

  if (!steps.length) {
    return <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">This activity has no question yet.</p>;
  }

  return (
    <div className="pb-[env(safe-area-inset-bottom)]">
      <div className="mb-3 flex items-center gap-4 text-sm">
        <span className="inline-flex items-center gap-1 font-semibold"><Coins className="h-4 w-4 text-primary" /> {score}/{max}</span>
        {left !== null && <span className={`inline-flex items-center gap-1 ${left <= 5 ? "font-bold text-destructive" : ""}`}><Timer className="h-4 w-4" /> {Math.max(0, left)}s</span>}
        <span className="ml-auto capitalize text-muted-foreground">{mode}</span>
      </div>

      {activity.imageUrl && (
        <img src={offlineMediaUrl(activity.imageUrl)} alt={activity.title} className="mb-3 max-h-48 w-full rounded-xl border border-border object-contain bg-card" />
      )}
      {activity.videoUrl && (
        <div className="mb-3">
          <video ref={videoRef} src={offlineMediaUrl(activity.videoUrl)} controls playsInline className="aspect-video w-full rounded-xl border border-border bg-muted" />
          <button type="button" onClick={() => setAuto((a) => !a)} aria-pressed={auto}
            className={`mt-2 rounded-full px-3 py-1 text-xs font-semibold ${auto ? "bg-primary text-primary-foreground" : "border border-border"}`}>
            Auto {auto ? "on" : "off"}
          </button>
        </div>
      )}

      <ol className="space-y-2 rounded-xl border border-border bg-card p-4 font-mono text-lg">
        <li className="flex gap-3"><span className="w-6 text-muted-foreground">0</span><span>{activity.lines[0].equation}</span></li>
        {steps.map((l, i) => {
          const r = results[i];
          return (
            <li key={i} className="flex items-center gap-3">
              <span className="w-6 text-muted-foreground">{i + 1}</span>
              {r ? (
                r.correct
                  ? <span className="text-[hsl(25_60%_35%)]">{r.written} <Check className="inline h-4 w-4" /></span>
                  : <span className="text-muted-foreground line-through">{r.written || "—"} <X className="inline h-4 w-4" /></span>
              ) : started && i === idx && !finished ? (
                <span className="min-h-[2.25rem] w-full rounded-md border-2 border-primary px-2 py-1 text-primary" aria-live="polite" aria-label={`Line ${i + 1}`}>
                  {written || <span className="text-muted-foreground">Tap the numbers below</span>}
                </span>
              ) : <span className="text-muted-foreground">…</span>}
            </li>
          );
        })}
      </ol>

      {!finished && (
        <div className="sticky bottom-0 mt-4 space-y-3 bg-background/95 py-3 backdrop-blur">
          {/* # / undo / redo first, Floating Numbers below it. */}
          <div className="flex justify-center gap-2">
            <button type="button" onClick={start} disabled={started} aria-label="Start line 1"
              className="inline-flex h-11 items-center gap-1 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-40">
              <Hash className="h-5 w-5" /> {started ? "" : "Start"}
            </button>
            <button type="button" aria-label="Undo" disabled={!pieces.length}
              onClick={() => { setRedo((r) => [pieces[pieces.length - 1], ...r]); setPieces((p) => p.slice(0, -1)); }}
              className="h-11 rounded-lg border border-border px-3 disabled:opacity-40"><Undo2 className="h-5 w-5" /></button>
            <button type="button" aria-label="Redo" disabled={!redo.length}
              onClick={() => { const [n, ...rest] = redo; setRedo(rest); place([...pieces, n]); setRedo(rest); }}
              className="h-11 rounded-lg border border-border px-3 disabled:opacity-40"><Redo2 className="h-5 w-5" /></button>
          </div>
          {started && (
            <div className="flex flex-wrap justify-center gap-2" aria-label="Floating Numbers">
              {steps[idx].fillers.map((f, i) => (
                <button key={i} type="button" onClick={() => place([...pieces, f])}
                  className="min-w-[48px] rounded-lg bg-primary px-3 py-2.5 font-mono text-lg font-semibold text-primary-foreground">
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {finished && (
        <section className="mt-4 rounded-xl border border-border bg-card p-4" aria-label="Your result">
          <p className="text-center text-lg font-bold">Score {score}/{max}</p>
          <p className="text-center text-xs text-muted-foreground">
            {results.filter((r) => r.correct).length} of {steps.length} lines right · {results.reduce((n, r) => n + r.seconds, 0)}s
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
              <RotateCcw className="h-4 w-4" /> Try again
            </button>
            <button type="button" onClick={onBack} className="rounded-full border border-border px-5 py-2 text-sm font-semibold">Back to Session</button>
          </div>
        </section>
      )}
    </div>
  );
}
