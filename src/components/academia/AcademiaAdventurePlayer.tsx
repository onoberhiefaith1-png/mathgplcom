// ACADEMIA ADVENTURE PLAYER — the Adventure video is the background; at each
// learning point (loop) the chosen Game's writing surfaces appear in front of
// it with that point's questions. Passing releases the loop and the video
// continues. No Smartboard opens here. Standalone Adventures are unaffected.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Loader2, Play, Volume2, VolumeX } from "lucide-react";
import ProgressColumn from "@/components/gamebuilder/ProgressColumn";
import { gameSoundSettingsOf } from "@/hooks/useGameRuntime";
import { applyBackgroundSound, holdBackgroundSound, setBackgroundVolume, stopBackgroundSound } from "@/lib/slate/gameSound";
import { musicVolume, narratorVolume, type AdventureAudio, DEFAULT_AUDIO } from "@/lib/academia/adventureMix";
import { loadAdventureAudio } from "@/lib/academia/adventureSlots";
import VideoBackgroundLayer, { type VideoBackgroundHandle } from "@/components/gamebuilder/VideoBackgroundLayer";
import ImaginePlayPage from "@/pages/imagine/ImaginePlayPage";
import { checkpointAt, checkpointsOf, narrationsOf, normalizeCanvas, type Narration, type Scene, type VideoBackground } from "@/lib/games/types";
import { useNarrationPlayback } from "@/lib/games/narration";
import { setChannelVolume, unlockAudio } from "@/lib/games/audio";
import { getGame } from "@/lib/games/games";
import { loadGame } from "@/lib/slate/storage";
import type { Game } from "@/lib/slate/types";
import { boardFor, listAdventureQuestions, listPassMarks, type AdventureQuestion } from "@/lib/academia/adventureSlots";
import { earnedMarks, hasPassed, passPctOf, progressFraction, questionsForPoint, recordResult, timeFillFraction } from "@/lib/academia/adventurePlay";

type Props = { activityId: string; adventureId: string; gameId: string | null; onExit: () => void };

export default function AcademiaAdventurePlayer({ activityId, adventureId, gameId, onExit }: Props) {
  const [video, setVideo] = useState<VideoBackground | null>(null);
  const [points, setPoints] = useState<Scene[]>([]);
  const [narrations, setNarrations] = useState<Narration[]>([]);
  const [game, setGame] = useState<Game | null>(null);
  const [questions, setQuestions] = useState<AdventureQuestion[]>([]);
  const [pass, setPass] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, number>>({});
  const [attempt, setAttempt] = useState(0);
  const [retry, setRetry] = useState(false);
  const [ended, setEnded] = useState(false);
  const [clock, setClock] = useState<{ start: number; deadline: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [mix, setMix] = useState<AdventureAudio>(DEFAULT_AUDIO);
  const [started, setStarted] = useState(false);
  const [master, setMaster] = useState(1);
  const [muted, setMuted] = useState(false);
  const [videoT, setVideoT] = useState(0);
  const [qIndex, setQIndex] = useState(0);
  const goToQ = useRef<((i: number) => void) | null>(null);
  const [completedQs, setCompletedQs] = useState<Set<string>>(new Set());
  const videoRef = useRef<VideoBackgroundHandle | null>(null);
  const storeKey = `academia-adventure:${activityId}`;

  // The Adventure's narrator: voice clips pinned to video timestamps, played
  // by the shared narration engine exactly as the standalone Adventure does.
  const narration = useNarrationPlayback(narrations, started && !ended, activityId, points);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [row, qs, pm, g, audio] = await Promise.all([
          getGame(adventureId),
          listAdventureQuestions(activityId),
          listPassMarks(activityId),
          gameId ? loadGame(gameId) : Promise.resolve(null),
          loadAdventureAudio(activityId).catch(() => DEFAULT_AUDIO),
        ]);
        if (!alive) return;
        const canvas = normalizeCanvas(row.canvas);
        if (!canvas.video?.path) throw new Error("This Adventure has no video yet.");
        setVideo(canvas.video);
        setPoints(checkpointsOf(canvas));
        setNarrations(narrationsOf(canvas));
        setQuestions(qs);
        setPass(pm);
        setGame(g);
        setMix(audio);
        try {
          const saved = JSON.parse(localStorage.getItem(storeKey) ?? "[]");
          if (Array.isArray(saved)) setDone(new Set(saved));
        } catch { /* fresh start */ }
        setReady(true);
      } catch (e) {
        if (alive) setError((e as Error).message || "This Adventure could not be opened.");
      }
    })();
    return () => { alive = false; };
  }, [activityId, adventureId, gameId, storeKey]);

  const active = points.find((p) => p.id === activeId) ?? null;
  const activeQs = useMemo(() => (active ? questionsForPoint(questions, active.id) : []), [active, questions]);
  // Every board is compiled once up front, so moving on never rebuilds them.
  const allBoards = useMemo(() => new Map(questions.map((q) => [q.id, boardFor(q)] as const)), [questions]);
  const boards = useMemo(() => activeQs.map((q) => allBoards.get(q.id)).filter((b): b is NonNullable<typeof b> => !!b), [activeQs, allBoards]);
  const total = boards.reduce((s, b) => s + b.totalMarks, 0);
  const earned = earnedMarks(results);
  const passPct = active ? passPctOf(pass[active.id]) : 100;

  const finishPoint = useCallback((id: string) => {
    narration.onStageChange(null);
    setDone((prev) => {
      const next = new Set(prev).add(id);
      try { localStorage.setItem(storeKey, JSON.stringify([...next])); } catch { /* storage full */ }
      return next;
    });
    setActiveId(null);
    setResults({});
    setClock(null);
    setRetry(false);
  }, [storeKey, narration]);

  const onTime = useCallback((t: number) => {
    setVideoT(t);
    narration.onTime(t);
    if (activeId) return;
    const hit = checkpointAt(points, t);
    if (!hit || done.has(hit.id)) return;
    // A learning point with nothing to solve simply plays through. The check
    // uses the boards compiled up front, so a point can never be skipped just
    // because a fresh compile was slow or diverged.
    const playable = !!game && questionsForPoint(questions, hit.id).some((q) => allBoards.get(q.id));
    if (!playable) { setDone((p) => new Set(p).add(hit.id)); return; }
    setActiveId(hit.id);
    narration.onStageChange(hit.id);
    narration.onLoopStart(hit);
    setResults({});
    setQIndex(0);
    setAttempt((n) => n + 1);
  }, [activeId, points, done, game, questions, allBoards, narration]);

  useEffect(() => {
    if (!clock) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [clock]);

  const embedded = useMemo(() => ({
    onQuestionDone: ({ questionRowId, marks }: { questionRowId: string; marks: number }) => {
      setResults((r) => recordResult(r, questionRowId, marks));
      setCompletedQs((p) => new Set(p).add(questionRowId));
    },
    // Partial verified marks count toward the learning point straight away.
    onMarks: ({ questionRowId, marks }: { questionRowId: string; marks: number }) => {
      if (questionRowId) setResults((r) => recordResult(r, questionRowId, marks));
    },
    onQuestion: (index: number, goTo: (i: number) => void) => { setQIndex(index); goToQ.current = goTo; },
    onFinished: () => setRetry(true),
    onClock: (deadline: number | null) => {
      setClock((c) => (deadline ? { start: c?.start ?? Date.now(), deadline } : null));
    },
  }), []);

  // Passing (at any question) releases the loop.
  useEffect(() => {
    if (active && total > 0 && hasPassed(earned, total, passPct)) finishPoint(active.id);
  }, [active, earned, total, passPct, finishPoint]);

  // One Game music track for the whole attempt: started on the student's tap,
  // held so question/learning-point changes never restart or stop it.
  const bgSlot = useMemo(() => (game ? gameSoundSettingsOf(game).background : null), [game]);
  useEffect(() => {
    if (!started || !bgSlot) return;
    holdBackgroundSound(true);
    applyBackgroundSound(bgSlot, true);
    return () => { holdBackgroundSound(false); stopBackgroundSound(true); };
  }, [started, bgSlot]);
  const gain = muted ? 0 : master;
  useEffect(() => {
    if (!started || !bgSlot) return;
    setBackgroundVolume(musicVolume(bgSlot.volume, videoT, mix, gain), true);
  }, [started, bgSlot, videoT, mix, gain]);
  useEffect(() => { if (ended) { holdBackgroundSound(false); stopBackgroundSound(true); } }, [ended]);

  // The narrator speaks at the teacher's level, scaled by the student's master volume.
  useEffect(() => {
    setChannelVolume("narration", narratorVolume(mix, gain));
  }, [mix, gain]);

  if (error) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-start gap-3 p-8">
        <h1 className="text-xl font-semibold">Adventure</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <button type="button" onClick={onExit} className="rounded border border-border px-3 py-1.5 text-sm hover:bg-accent">Back</button>
      </div>
    );
  }
  if (!ready || !video) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const loop = active && active.loopEnd != null ? { start: active.loopStart ?? 0, end: active.loopEnd } : null;
  const progress = progressFraction(earned, total);
  // Time bar shows the time LEFT, filling bottom → top; a time bonus raises it.
  const timeLeft = clock ? 1 - timeFillFraction(clock.start, clock.deadline, now) : 0;
  const learningBar = active?.elements?.find((e) => e.progress && e.progress.role !== "time") ?? null;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-foreground">
      <div className="absolute inset-0">
        <VideoBackgroundLayer
          ref={videoRef}
          video={video}
          playing={started && !ended}
          loop={loop}
          onTime={onTime}
          onEnded={() => setEnded(true)}
          audible={started && !muted}
          volume={narratorVolume(mix, gain)}
        />
      </div>

      {!started && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/40">
          <button type="button" onClick={() => { unlockAudio(); setStarted(true); }} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground shadow-xl">
            <Play className="h-5 w-5" /> Start Adventure
          </button>
        </div>
      )}

      {active && game && boards.length > 0 && (
        <div className="absolute inset-0 z-10">
          <ImaginePlayPage
            key={`${active.id}:${attempt}`}
            offline={{
              activityId: `${activityId}:${active.id}`,
              game,
              board: boards[0],
              boards,
              startingLives: Math.max(1, Number(game.status?.lives) || 3),
              assetUrls: {},
              onExit,
              embedded,
            }}
          />
          {/* Learning-point progress: the Adventure's own bar, filled by verified marks. */}
          <div className="pointer-events-none absolute bottom-24 right-2 top-16 z-30 flex w-12 flex-col items-center justify-end sm:w-16" aria-label={`Score ${earned} of ${total}, pass ${passPct}%`}>
            {learningBar?.progress ? (
              <div className="relative w-full">
                <ProgressColumn
                  config={{ ...learningBar.progress, currentMarks: earned, totalMarks: total || 1 }}
                  fallbackPath={learningBar.storagePath}
                  fallbackMedia={learningBar.mediaType}
                  fallbackSource={learningBar.source}
                />
              </div>
            ) : (
              <div className="relative h-full w-4 overflow-hidden rounded-full border-2 border-background bg-background/50 shadow-lg">
                <div className="absolute inset-x-0 bottom-0 bg-primary transition-all duration-500" style={{ height: `${progress * 100}%` }} />
                <div className="absolute inset-x-0 h-0.5 bg-foreground" style={{ bottom: `${passPct}%` }} />
              </div>
            )}
            <span className="mt-1 rounded bg-background/85 px-1.5 text-xs font-semibold text-foreground">{Math.round(progress * 100)}%</span>
          </div>
          {clock && (
            <div className="pointer-events-none absolute bottom-24 left-2 top-16 z-30 flex w-4 flex-col justify-end" aria-label="Time left">
              <div className="relative h-full w-4 overflow-hidden rounded-full border-2 border-background bg-background/50 shadow-lg">
                <div className="absolute inset-x-0 bottom-0 bg-accent transition-all duration-200" style={{ height: `${timeLeft * 100}%` }} />
              </div>
            </div>
          )}
          {/* Free movement between this learning point's questions. Pinned to
              the TOP so it never covers the floating numbers on the surface. */}
          {boards.length > 1 && (
            <div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-background/90 px-2 py-1 text-xs shadow">
              <button type="button" aria-label="Previous question" disabled={qIndex <= 0} onClick={() => goToQ.current?.(qIndex - 1)} className="rounded-full p-1 hover:bg-muted disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
              <span>Question {qIndex + 1} of {boards.length}{boards[qIndex] && completedQs.has(boards[qIndex]!.questionRowId) ? " ✓" : ""}</span>
              <button type="button" aria-label="Next question" disabled={qIndex >= boards.length - 1} onClick={() => goToQ.current?.(qIndex + 1)} className="rounded-full p-1 hover:bg-muted disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
            </div>
          )}
          {retry && (
            <div className="absolute inset-x-0 top-14 z-40 mx-auto w-fit rounded-lg border border-border bg-background px-4 py-3 text-sm shadow-xl">
              You scored {earned} of {total}. You need {passPct}% to continue.
              <button type="button" className="ml-3 rounded bg-primary px-3 py-1 text-primary-foreground" onClick={() => { setResults({}); setRetry(false); setClock(null); setAttempt((n) => n + 1); }}>Try again</button>
            </div>
          )}
        </div>
      )}

      {/* One master volume for the whole mix. */}
      {started && (
        <div className="absolute right-3 top-3 z-40 flex items-center gap-1 rounded-full border border-border bg-background/85 px-2 py-1 shadow">
          <button type="button" aria-label={muted ? "Sound on" : "Sound off"} onClick={() => setMuted((m) => !m)} className="p-0.5">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input type="range" aria-label="Volume" min={0} max={100} value={Math.round(master * 100)} onChange={(e) => { setMaster(Number(e.target.value) / 100); setMuted(false); }} className="w-20 accent-primary" />
        </div>
      )}

      {!active && (
        <button type="button" onClick={onExit} className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-md border border-border bg-background/85 px-3 py-1.5 text-sm shadow">
          <ArrowLeft className="h-4 w-4" /> Session
        </button>
      )}
      {ended && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/70">
          <div className="rounded-xl border border-border bg-background p-6 text-center shadow-xl">
            <p className="text-lg font-semibold">Adventure complete</p>
            <button type="button" onClick={onExit} className="mt-3 rounded bg-primary px-4 py-2 text-sm text-primary-foreground">Back to Session</button>
          </div>
        </div>
      )}
    </div>
  );
}
