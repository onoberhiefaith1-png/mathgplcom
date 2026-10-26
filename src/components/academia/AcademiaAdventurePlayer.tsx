// ACADEMIA ADVENTURE PLAYER — the Adventure video is the background; at each
// learning point (loop) the chosen Game's writing surfaces appear in front of
// it with that point's questions. Passing releases the loop and the video
// continues. No Smartboard opens here. Standalone Adventures are unaffected.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Loader2, Play, Volume2, VolumeX } from "lucide-react";
import DefaultBar, { DesignedStageBar } from "@/components/academia/AdventureBar";
import { coverStage, PLAYER_LAYERS } from "@/lib/academia/barGeometry";
import { gameSoundSettingsOf } from "@/hooks/useGameRuntime";
import { applyBackgroundSound, holdBackgroundSound, prepareGameSounds, prepareSound, setBackgroundVolume, setSoundMaster, stopBackgroundSound } from "@/lib/slate/gameSound";
import { musicVolume, narratorVolume, segmentsFromClips, type AdventureAudio, DEFAULT_AUDIO } from "@/lib/academia/adventureMix";
import { loadAdventureAudio } from "@/lib/academia/adventureSlots";
import VideoBackgroundLayer, { type VideoBackgroundHandle } from "@/components/gamebuilder/VideoBackgroundLayer";
import ImaginePlayPage from "@/pages/imagine/ImaginePlayPage";
import AdventureGameBoundary from "@/components/academia/AdventureGameBoundary";
import { CASTLE_URL, backdropFor } from "@/lib/academia/offlineLook";
import { checkpointsOf, narrationsOf, normalizeCanvas, sceneTimeSeconds, type Narration, type Scene, type VideoBackground } from "@/lib/games/types";
import { useNarrationPlayback } from "@/lib/games/narration";
import { setChannelVolume, unlockAudio } from "@/lib/games/audio";
import { getGame } from "@/lib/games/games";
import { loadGame } from "@/lib/slate/storage";
import type { Game } from "@/lib/slate/types";
import { boardFor, listAdventureQuestions, listPassMarks, type AdventureQuestion } from "@/lib/academia/adventureSlots";
import { clockExpired, designedBarsOf, earnedMarks, effectiveClock, hasPassed, nextGameClock, passPctOf, pointDue, pointTimeSeconds, progressFraction, questionsForPoint, recordResult, showTimeBar, startPointClock, timeLeftFraction, type PointClock } from "@/lib/academia/adventurePlay";
import { canOfferStart, runStagedPreload, withDeadline, withTimeout, type PreloadJob } from "@/lib/academia/adventurePreload";

import type { OfflineAdventure } from "@/lib/offline/extendedActivities";
import { offlineMediaUrl } from "@/lib/offline/prepareOffline";
import { primeAssetUrl } from "@/lib/slate/assets";
import { primeSignedUrls } from "@/lib/games/urls";

type Props = { offline?: OfflineAdventure; activityId: string; adventureId: string; gameId: string | null; onExit: () => void;
  /** Sized by its parent (the app's full-screen frame) instead of the window height. */
  fillParent?: boolean };

export default function AcademiaAdventurePlayer({ activityId, adventureId, gameId, onExit, offline, fillParent = false }: Props) {
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
  // The Game question's own timer (reported by the embedded Game) and the learning
  // point's designed countdown. The time bar follows whichever is running.
  const [gameClock, setGameClock] = useState<PointClock | null>(null);
  const [pointClock, setPointClock] = useState<PointClock | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadStage, setLoadStage] = useState("Opening the Adventure…");
  // The picture can play on (readyState >= 3 / canplaythrough), not just "its size is known".
  const [videoReady, setVideoReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState(() => ({ w: typeof window === "undefined" ? 0 : window.innerWidth, h: typeof window === "undefined" ? 0 : window.innerHeight }));
  const [videoFrame, setVideoFrame] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  const [essentialReady, setEssentialReady] = useState(false);
  const [waitedMs, setWaitedMs] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [mix, setMix] = useState<AdventureAudio>(DEFAULT_AUDIO);
  const [started, setStarted] = useState(false);
  const [resumeAt, setResumeAt] = useState(0);
  // Every sound is downloaded before Start is offered, so nothing loads mid-play.
  const [media, setMedia] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [master, setMaster] = useState(1);
  const [muted, setMuted] = useState(false);
  const [videoT, setVideoT] = useState(0);
  const [qIndex, setQIndex] = useState(0);
  const goToQ = useRef<((i: number) => void) | null>(null);
  const [completedQs, setCompletedQs] = useState<Set<string>>(new Set());
  const videoRef = useRef<VideoBackgroundHandle | null>(null);
  // The page hands in a new onExit every render; the Game must see one stable function.
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const exitStable = useCallback(() => onExitRef.current(), []);
  const storeKey = `academia-adventure:${activityId}`;

  // The Adventure's narrator: voice clips pinned to video timestamps, played
  // by the shared narration engine exactly as the standalone Adventure does.
  const narration = useNarrationPlayback(narrations, started && !ended, activityId, points);

  useEffect(() => {
    let alive = true;
    setError(null);
    setReady(false);
    setEssentialReady(false);
    setLoadStage("Opening the Adventure…");
    (async () => {
      try {
        const assetUrls = Object.fromEntries(Object.entries(offline?.assetUrls ?? {}).map(([path, url]) => [path, offlineMediaUrl(url)]));
        if (offline) {
          primeSignedUrls(assetUrls, 365 * 24 * 3600);
          Object.entries(assetUrls).forEach(([path, url]) => primeAssetUrl(path, url));
        }
        setLoadStage("Loading the Adventure…");
        // Everything the page needs is requested in parallel, each with its own
        // time limit and one retry. A Game that fails to load is not fatal: the
        // learning point says so and offers to fetch it again.
        const [row, qs, pm, g, audio] = offline ? [
          { canvas: offline.canvas }, offline.questions, offline.pass, offline.game, offline.audio,
        ] as const : await Promise.all([
          withDeadline(() => getGame(adventureId), 25_000, "Opening the Adventure"),
          withDeadline(() => listAdventureQuestions(activityId), 25_000, "Loading the questions"),
          withDeadline(() => listPassMarks(activityId), 25_000, "Loading the pass marks"),
          gameId ? withDeadline(() => loadGame(gameId), 25_000, "Loading the Game").catch(() => null) : Promise.resolve(null),
          withTimeout(loadAdventureAudio(activityId), 10_000, DEFAULT_AUDIO),
        ]);
        if (!alive) return;
        const canvas = normalizeCanvas(offline ? cacheCanvasMedia(row.canvas) : row.canvas);
        if (offline) {
          if (canvas.video?.path) canvas.video = { ...canvas.video, source: "url", path: offlineMediaUrl(canvas.video.path) };
          canvas.narrations = narrationsOf(canvas).map((n) => ({ ...n, source: "url", path: offlineMediaUrl(n.path) }));
        }
        if (!canvas.video?.path) throw new Error("This Adventure has no video yet.");
        setVideo(canvas.video);
        setPoints(checkpointsOf(canvas));
        setNarrations(narrationsOf(canvas));
        setQuestions(qs);
        setPass(pm);
        setGame(g);
        const resolvedAudio = offline && audio.music ? { ...audio, music: { ...audio.music, path: offlineMediaUrl(audio.music.path) } } : audio;
        setMix(resolvedAudio);
        if (g) {
          const sound = gameSoundSettingsOf(g);
          prepareGameSounds(sound);
          if (sound.background?.ref?.path) void prepareSound(sound.background.ref.path);
        }
        try {
          const saved = JSON.parse(localStorage.getItem(storeKey) ?? "[]");
          if (Array.isArray(saved)) setDone(new Set(saved));
          const pos = Number(localStorage.getItem(`${storeKey}:pos`) ?? 0);
          if (Number.isFinite(pos)) setResumeAt(pos);
        } catch { /* fresh start */ }
        setReady(true);
        setLoadStage("Getting the sounds ready…");
        // Staged download. Only what Start needs (the music and the first narrator
        // clips) is waited for, and only up to a short cap; the remaining clips
        // keep downloading quietly behind the video. Nothing here can block Start for long.
        const { getSignedUrl } = await import("@/lib/games/urls");
        const narrationClips = narrationsOf(canvas);
        const fetchBlob = async (url: string | null) => {
          try { if (url) await fetch(url, { cache: "force-cache" }).then((r) => r.blob()); } catch { /* a missing clip never blocks Start */ }
        };
        const urlOf = (n: Narration) => (n.source === "url" ? Promise.resolve(n.path) : getSignedUrl(n.path).catch(() => null));
        const jobs: PreloadJob[] = narrationClips.map((n, i) => ({ key: `n${i}`, kind: "narration", at: n.at, run: async () => fetchBlob(await urlOf(n)) }));
        if (resolvedAudio.music?.path) {
          const musicPath = resolvedAudio.music.path;
          jobs.push({ key: "music", kind: "music", run: async () => fetchBlob(offline ? musicPath : await getSignedUrl(musicPath).catch(() => null)) });
        } else if (g) {
          const bgPath = gameSoundSettingsOf(g).background?.ref?.path;
          if (bgPath) jobs.push({ key: "bg", kind: "music", run: async () => fetchBlob(await prepareSound(bgPath)) });
        }
        // Narration windows come from the clips themselves (time + length).
        if (audio.segments.length === 0 && narrationClips.length) {
          void Promise.all(narrationClips.map(async (n) => {
            const url = n.source === "url" ? n.path : await getSignedUrl(n.path).catch(() => null);
            const duration = url ? await clipLength(url) : 0;
            return { at: n.at, duration };
          })).then((clips) => { if (alive) setMix((m) => ({ ...m, segments: segmentsFromClips(clips) })); });
        }
        const staged = runStagedPreload(jobs, {
          essentialCapMs: 6_000,
          perJobMs: 15_000,
          concurrency: 3,
          onProgress: (p) => { if (alive) setMedia(p); },
          isCancelled: () => !alive,
        });
        void staged.ready.then(() => { if (alive) setEssentialReady(true); });
      } catch (e) {
        if (alive) setError((e as Error).message || "This Adventure could not be opened.");
      }
    })();
    return () => { alive = false; };
  }, [activityId, adventureId, gameId, storeKey, offline, loadAttempt]);

  // How long the data has been in while Start is still waiting on the video: after a
  // short cap Start is offered anyway (the video keeps buffering behind the tap).
  useEffect(() => {
    if (!ready || started) return;
    const t0 = Date.now();
    setWaitedMs(0);
    const id = window.setInterval(() => setWaitedMs(Date.now() - t0), 500);
    return () => window.clearInterval(id);
  }, [ready, started]);
  const startReady = canOfferStart({ dataReady: ready, essentialReady, videoLoaded: videoReady, waitedMs });

  // Fetch the Game again (without reloading the whole page) when it failed to load.
  const [gameBusy, setGameBusy] = useState(false);
  const retryGame = useCallback(async () => {
    if (!gameId || offline) { window.location.reload(); return; }
    setGameBusy(true);
    try {
      const g = await withDeadline(() => loadGame(gameId), 25_000, "Loading the Game");
      if (g) { const sound = gameSoundSettingsOf(g); prepareGameSounds(sound); setGame(g); }
    } catch { /* the panel stays so the student can try again */ }
    setGameBusy(false);
  }, [gameId, offline]);

  // The stage (the video's 16:9 frame, scaled to cover the screen) follows the player's own size.
  useEffect(() => {
    const el = rootRef.current;
    const measure = () => {
      const r = el?.getBoundingClientRect();
      setView((v) => (r && r.width > 0 && r.height > 0 && (v.w !== r.width || v.h !== r.height) ? { w: r.width, h: r.height } : v));
    };
    measure();
    if (el && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [ready, video]);

  const active = points.find((p) => p.id === activeId) ?? null;
  const activeQs = useMemo(() => (active ? questionsForPoint(questions, active.id) : []), [active, questions]);
  // Every board is compiled once up front, so moving on never rebuilds them.
  // A question that cannot be compiled is left out (and reported below) instead of
  // throwing during render, which would blank the whole Adventure.
  const allBoards = useMemo(() => new Map(questions.map((q) => {
    try { return [q.id, boardFor(q)] as const; } catch { return [q.id, null] as const; }
  })), [questions]);
  const boards = useMemo(() => activeQs.map((q) => allBoards.get(q.id)).filter((b): b is NonNullable<typeof b> => !!b), [activeQs, allBoards]);
  const total = boards.reduce((s, b) => s + b.totalMarks, 0);
  const earned = earnedMarks(results);
  const passPct = active ? passPctOf(pass[active.id]) : 100;

  const enteringRef = useRef<string | null>(null);
  const finishPoint = useCallback((id: string) => {
    narration.onStageChange(null);
    setDone((prev) => {
      const next = new Set(prev).add(id);
      try { localStorage.setItem(storeKey, JSON.stringify([...next])); } catch { /* storage full */ }
      return next;
    });
    enteringRef.current = null;
    setActiveId(null);
    setResults({});
    setGameClock(null);
    setPointClock(null);
    setRetry(false);
  }, [storeKey, narration]);

  const lastSave = useRef(0);
  // Enter the learning point the playhead has reached (or already jumped past).
  const maybeEnter = useCallback((t: number) => {
    if (activeId) return;
    const hit = pointDue(points, t, done);
    if (!hit) { enteringRef.current = null; return; }
    // A learning point with nothing to solve simply plays through. The check
    // uses the boards compiled up front, so a point can never be skipped just
    // because a fresh compile was slow or diverged.
    // A point WITH questions never silently skips: if the Game is missing the
    // student sees why (message below) instead of the video just playing on.
    const hasQuestions = questionsForPoint(questions, hit.id).length > 0;
    if (!hasQuestions) { setDone((p) => new Set(p).add(hit.id)); return; }
    if (enteringRef.current === hit.id) return; // already on its way in (two ticks before the render)
    enteringRef.current = hit.id;
    narration.onStageChange(hit.id);
    setActiveId(hit.id);
    narration.onLoopStart(hit);
    setResults({});
    setQIndex(0);
    setGameClock(null);
    setAttempt((n) => n + 1);
  }, [activeId, points, done, questions, narration]);

  // No picture to wait for (video not saved offline, failed): open the next learning point directly.
  const continueWithoutVideo = useCallback(() => {
    const next = points.find((p) => !done.has(p.id));
    if (!next) { setEnded(true); return; }
    maybeEnter(next.loopStart ?? 0);
  }, [points, done, maybeEnter]);

  const onTime = useCallback((t: number) => {
    setVideoT(t);
    // Assign the learning point before a timestamp can start its narrator.
    // Otherwise its first clip is owned by the plain timeline and survives exit.
    if (!activeId) {
      const due = pointDue(points, t, done);
      if (due && questionsForPoint(questions, due.id).length > 0 && enteringRef.current !== due.id) narration.onStageChange(due.id);
    }
    narration.onTime(t);
    // Remember where the student is, so coming back offers Continue.
    if (Math.abs(t - lastSave.current) >= 2) {
      lastSave.current = t;
      try { localStorage.setItem(`${storeKey}:pos`, String(t)); } catch { /* storage full */ }
    }
    maybeEnter(t);
  }, [activeId, points, done, questions, narration, storeKey, maybeEnter]);

  // `timeupdate` only fires about four times a second; between those ticks the
  // playhead can run past a short learning point. While no point is open, check
  // the playhead more often so a point is entered where it starts.
  useEffect(() => {
    if (!started || ended || activeId) return;
    const id = window.setInterval(() => {
      const t = videoRef.current?.currentTime();
      if (typeof t === "number" && t > 0) maybeEnter(t);
    }, 100);
    return () => window.clearInterval(id);
  }, [started, ended, activeId, maybeEnter]);

  // The clock the time bar follows: the Game question's own timer when it has
  // one, else the learning point's designed countdown.
  const clock = effectiveClock(gameClock, pointClock);
  useEffect(() => {
    if (!clock) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [clock]);

  // A learning point with a designed countdown starts it when the point opens
  // (and again on every retry). Running out before the pass mark offers a retry.
  const designedSeconds = active ? pointTimeSeconds(active, sceneTimeSeconds(active)) : 0;
  useEffect(() => {
    if (!active) return;
    setPointClock(startPointClock(designedSeconds, Date.now()));
    setNow(Date.now());
  }, [active?.id, attempt, designedSeconds]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!active || retry || !clock || !clockExpired(clock, now)) return;
    if (!gameClock) setRetry(true); // the Game reports its own timer running out itself
  }, [active, retry, clock, gameClock, now]);

  const embedded = useMemo(() => ({
    onQuestionDone: ({ questionRowId, marks }: { questionRowId: string; marks: number }) => {
      setResults((r) => recordResult(r, questionRowId, marks));
      setCompletedQs((p) => new Set(p).add(questionRowId));
    },
    // Partial verified marks count toward the learning point straight away.
    onMarks: ({ questionRowId, marks }: { questionRowId: string; marks: number }) => {
      if (questionRowId) setResults((r) => recordResult(r, questionRowId, marks));
    },
    // A different question starts its own timer from zero.
    onQuestion: (index: number, goTo: (i: number) => void) => { setQIndex((prev) => { if (prev !== index) setGameClock(null); return index; }); goToQ.current = goTo; },
    onFinished: () => setRetry(true),
    onClock: (deadline: number | null) => {
      setGameClock((c) => nextGameClock(c, deadline, Date.now()));
    },
  }), []);

  // The Game's props are built ONCE per learning-point attempt. A fresh object on
  // every render (the playhead re-renders this page several times a second) made
  // the embedded Game reload its saved Game and reset its state each time.
  const assetUrlsForGame = useMemo(
    () => Object.fromEntries(Object.entries(offline?.assetUrls ?? {}).map(([path, url]) => [path, offlineMediaUrl(url)])),
    [offline],
  );
  const gameProps = useMemo(() => (active && game && boards.length > 0 ? {
    activityId: `${activityId}:${active.id}`,
    game,
    board: boards[0]!,
    boards,
    startingLives: Math.max(1, Number(game.status?.lives) || 3),
    assetUrls: assetUrlsForGame,
    onExit: exitStable,
    embedded,
  } : null), [active, game, boards, activityId, assetUrlsForGame, exitStable, embedded]);

  // Passing (at any question) releases the loop.
  useEffect(() => {
    if (active && total > 0 && hasPassed(earned, total, passPct)) finishPoint(active.id);
  }, [active, earned, total, passPct, finishPoint]);

  // One Game music track for the whole attempt: started on the student's tap,
  // held so question/learning-point changes never restart or stop it.
  const customMusic = mix.music?.path ?? null;
  const bgSlot = useMemo(() => (game && !customMusic ? gameSoundSettingsOf(game).background : null), [game, customMusic]);
  // Teacher-uploaded Adventure music: one looping element for the whole attempt.
  const musicEl = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!started || !customMusic) return;
    let alive = true;
    const el = new Audio();
    el.loop = true;
    el.volume = 0;
    musicEl.current = el;
    void import("@/lib/games/urls").then(({ getSignedUrl }) => offline ? Promise.resolve(offlineMediaUrl(customMusic)) : getSignedUrl(customMusic)).then((url) => {
      if (!alive || !url) return;
      el.src = url;
      void el.play().catch(() => undefined);
    });
    return () => { alive = false; el.pause(); el.src = ""; musicEl.current = null; };
  }, [started, customMusic, offline]);
  useEffect(() => {
    const el = musicEl.current;
    if (el) { const v = musicVolume(mix.musicVolume, videoT, mix, muted ? 0 : master); el.volume = v; el.muted = v <= 0; }
  }, [videoT, mix, master, muted]);
  useEffect(() => { if (ended) musicEl.current?.pause(); }, [ended]);
  // A finished Adventure starts fresh next time (unlimited attempts).
  useEffect(() => {
    if (!ended) return;
    try { localStorage.removeItem(`${storeKey}:pos`); localStorage.removeItem(storeKey); } catch { /* ignore */ }
  }, [ended, storeKey]);
  const restartAdventure = useCallback(() => {
    try { localStorage.removeItem(`${storeKey}:pos`); localStorage.removeItem(storeKey); } catch { /* ignore */ }
    lastSave.current = 0;
    enteringRef.current = null;
    setDone(new Set());
    setResumeAt(0);
  }, [storeKey]);
  useEffect(() => {
    if (!started || !bgSlot) return;
    holdBackgroundSound(true);
    applyBackgroundSound(bgSlot, true);
    return () => { holdBackgroundSound(false); stopBackgroundSound(true); };
  }, [started, bgSlot]);
  const gain = muted ? 0 : master;
  // Student master scales every Game sound (music + rewards); 0 = silent everywhere.
  useEffect(() => { setSoundMaster(gain); return () => setSoundMaster(1); }, [gain]);
  useEffect(() => {
    if (!started || !bgSlot) return;
    setBackgroundVolume(musicVolume(mix.musicVolume, videoT, mix, gain), true);
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
        <div className="flex gap-2">
          <button type="button" onClick={onExit} className="rounded border border-border px-3 py-1.5 text-sm hover:bg-accent">Back</button>
          <button type="button" onClick={() => setLoadAttempt((n) => n + 1)} className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground">Try again</button>
        </div>
      </div>
    );
  }
  if (!ready || !video) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>{loadStage}</span>
    </div>
  );

  const loop = active && active.loopEnd != null ? { start: active.loopStart ?? 0, end: active.loopEnd } : null;
  const progress = progressFraction(earned, total);
  // Time bar shows the time LEFT, filling bottom → top; a time bonus raises it.
  const timeLeft = timeLeftFraction(clock, now);
  // The same bar roles the Adventure editor uses (the first bar is the clock when none is marked).
  const bars = designedBarsOf(active?.elements);
  const stage = coverStage(view.w, view.h);
  const backdrop = backdropFor({ frame: videoFrame, failed: videoFailed, started, online });
  const timeBarShown = showTimeBar(clock, active?.timerVisible);

  return (
    <div ref={rootRef} className={`relative w-full overflow-hidden bg-slate-800 ${fillParent ? "h-full" : "h-[100dvh]"}`}>
      {/* Always painted beneath the video: with no video frame (not saved offline, failed, still
          loading) the student sees the bundled castle, never a black screen. */}
      <img src={CASTLE_URL} alt="" aria-hidden data-testid="adventure-backdrop" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      {/* The stage: the video's own 16:9 frame scaled to cover the screen. The creator's bars are
          placed inside it at their stored place, so they sit on the same spot of the picture on a
          phone, a tablet and a desktop. It is a layer BELOW the Game (z-10), so the writing
          surface, controls and floating numbers are always in front of the bars. */}
      <div data-testid="adventure-stage" className="pointer-events-none absolute" style={{ ...(stage.width > 0 ? { left: stage.left, top: stage.top, width: stage.width, height: stage.height } : { inset: 0 }), zIndex: PLAYER_LAYERS.stage }}>
        <VideoBackgroundLayer
          className={backdrop.showVideo ? undefined : "opacity-0"}
          onError={() => setVideoFailed(true)}
          onFrame={() => { setVideoFrame(true); setVideoFailed(false); }}
          onReady={() => setVideoReady(true)}
          onBuffering={setBuffering}
          ref={videoRef}
          video={video}
          playing={started && !ended}
          loop={loop}
          onTime={onTime}
          onEnded={() => setEnded(true)}
          audible={started && !muted}
          volume={narratorVolume(mix, gain)}
        />
        {active && gameProps && (
          <div data-testid="bar-layer" className="pointer-events-none absolute inset-0 overflow-visible">
            {bars.learning && <DesignedStageBar element={bars.learning} current={earned} max={total || 1} stageWidth={stage.width} label="Learning progress" />}
            {timeBarShown && bars.time && <DesignedStageBar element={bars.time} current={timeLeft * 1000} max={1000} stageWidth={stage.width} label="Time left" fillIsTimeLeft />}
          </div>
        )}
      </div>

      {active && gameProps && (
        <div data-testid="bar-edge-layer" className="pointer-events-none absolute inset-0" style={{ zIndex: PLAYER_LAYERS.defaultBars }}>
          {/* Learning-point progress: a plain default only when the creator never designed a bar. */}
          <div className="absolute bottom-24 right-2 top-16 flex flex-col items-end justify-end" aria-label={`Score ${earned} of ${total}, pass ${passPct}%`}>
            {!bars.learning && <DefaultBar current={earned} max={total || 1} passPct={passPct} label="Learning progress" />}
            <span className="mt-1 rounded bg-background/85 px-1.5 text-xs font-semibold text-foreground shadow">{Math.round(progress * 100)}%</span>
          </div>
          {timeBarShown && (
            <div className="absolute bottom-24 left-2 top-16 flex flex-col items-start justify-end" aria-label={bars.time ? undefined : "Time left"}>
              {!bars.time && <DefaultBar current={timeLeft * 1000} max={1000} tone="accent" label="Time left" />}
            </div>
          )}
        </div>
      )}

      {!started && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/40">
          {startReady ? (
            resumeAt > 1 ? (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button type="button" onClick={() => { unlockAudio(); narration.reset(); videoRef.current?.seek(resumeAt); setStarted(true); }} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground shadow-xl">
                  <Play className="h-5 w-5" /> Continue
                </button>
                <button type="button" onClick={() => { unlockAudio(); narration.reset(); restartAdventure(); videoRef.current?.seek(0); setStarted(true); }} className="inline-flex items-center gap-2 rounded-full bg-card px-6 py-3 text-lg font-semibold text-foreground shadow-xl">
                  Start again
                </button>
              </div>
            ) : (
            <button type="button" onClick={() => { unlockAudio(); narration.reset(); restartAdventure(); setStarted(true); }} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground shadow-xl">
              <Play className="h-5 w-5" /> Start Adventure
            </button>
            )
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full bg-card px-6 py-3 text-base font-semibold text-foreground shadow-xl">
              <Loader2 className="h-5 w-5 animate-spin" /> Getting ready… {media.total ? `${Math.min(media.done, media.total)}/${media.total}` : ""}
            </div>
          )}
        </div>
      )}

      {started && buffering && !ended && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[41] -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-3 py-1 text-xs shadow" role="status" data-testid="video-buffering">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buffering the video…
        </div>
      )}

      {backdrop.notice && !active && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-[56] mx-auto flex w-[min(92%,30rem)] flex-col items-center gap-1.5 rounded-lg border border-border bg-background/90 px-3 py-1.5 text-center text-xs shadow" role="status">
          <span>{backdrop.notice}</span>
          {!ended && (
            <button type="button" onClick={continueWithoutVideo} className="pointer-events-auto rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Continue without the video</button>
          )}
        </div>
      )}

      {active && !gameProps && (
        <div className="absolute inset-x-0 top-1/3 z-[60] mx-auto w-[min(92%,26rem)] rounded-xl border bg-background p-4 text-center shadow-lg" role="alert">
          <p className="text-sm font-medium">{!game ? (gameId ? "The Game for this Adventure could not be loaded." : "No Game has been chosen for this Adventure yet.") : "These questions could not be prepared."}</p>
          <p className="mt-1 text-xs text-muted-foreground">{!game ? (gameId ? "Check your connection, then try again." : "Ask your teacher to choose a Game for it.") : "Ask your teacher to check this learning point's questions."}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {(!game && gameId) && (
              <button type="button" disabled={gameBusy} onClick={() => void retryGame()} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60">{gameBusy ? "Trying…" : "Try again"}</button>
            )}
            <button type="button" onClick={() => finishPoint(active.id)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent">Skip this learning point</button>
          </div>
        </div>
      )}

      {active && gameProps && (
        <div className="absolute inset-0 z-10">
          <AdventureGameBoundary resetKey={`${active.id}:${attempt}`} onSkip={() => finishPoint(active.id)}>
            <ImaginePlayPage key={`${active.id}:${attempt}`} offline={gameProps} />
          </AdventureGameBoundary>
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
              <button type="button" className="ml-3 rounded bg-primary px-3 py-1 text-primary-foreground" onClick={() => { setResults({}); setRetry(false); setGameClock(null); setAttempt((n) => n + 1); }}>Try again</button>
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

/** Length of an audio clip in seconds (0 when it can't be read). */
function clipLength(url: string): Promise<number> {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = "metadata";
    const t = window.setTimeout(() => resolve(0), 8000);
    a.onloadedmetadata = () => { window.clearTimeout(t); resolve(Number.isFinite(a.duration) ? a.duration : 0); };
    a.onerror = () => { window.clearTimeout(t); resolve(0); };
    a.src = url;
  });
}

/** Every public media reference uses the same cache key as the download worker. */
function cacheCanvasMedia(value: unknown): unknown {
  if (typeof value === "string") return /^(https?:\/\/|\/api\/public\/academia-media\?)/.test(value) ? offlineMediaUrl(value) : value;
  if (Array.isArray(value)) return value.map(cacheCanvasMedia);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cacheCanvasMedia(v)]));
  return value;
}
